"""
Finans Router

Endpoint'ler:
  GET  /finance/overview  — Genel Bakış (KPI'lar, aylık gelir, kategori, top ilanlar)
  GET  /finance/context   — Finans Asistanı için tam finansal bağlam
  POST /finance/chat      — Finans Asistanı sohbet
"""

import asyncio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from app.routers.auth import get_current_user
from app.database.supabase_client import supabase
from app.services.gemini_service import finance_assistant_chat
from collections import defaultdict
from datetime import date


class FinanceChatMessage(BaseModel):
    role: str
    text: str

class FinanceChatRequest(BaseModel):
    message: str
    history: List[FinanceChatMessage] = []
    context: dict = {}

router = APIRouter()


@router.get("/overview")
async def get_overview(current_user=Depends(get_current_user)):
    user_id = current_user.id

    # ── 1. Tüm siparişleri çek ───────────────────────────────────────────────
    orders_res = supabase.table("orders") \
        .select("listing_id, sale_price, cargo_price, commission_amt, cogs, net_revenue, quantity, status, order_date") \
        .eq("seller_id", user_id) \
        .execute()
    orders = orders_res.data or []

    # ── 2. Listing başlık + kategori haritası ────────────────────────────────
    listings_res = supabase.table("listings") \
        .select("id, title, category") \
        .eq("user_id", user_id) \
        .execute()
    listing_map = {l["id"]: l for l in (listings_res.data or [])}

    # ── 3. KPI'lar ──────────────────────────────────────────────────────────
    completed = [o for o in orders if o["status"] in ("delivered", "shipped")]
    cancelled = [o for o in orders if o["status"] == "cancelled"]

    total_net_revenue   = round(sum(o["net_revenue"] or 0 for o in completed), 2)
    total_gross_revenue = round(sum((o["sale_price"] or 0) * (o["quantity"] or 1) for o in completed), 2)
    total_orders        = len(orders)
    completed_count     = len(completed)
    avg_order_value     = round(total_gross_revenue / completed_count, 2) if completed_count else 0
    cancellation_rate   = round(len(cancelled) / total_orders * 100, 1) if total_orders else 0
    total_commission    = round(sum(o["commission_amt"] or 0 for o in completed), 2)
    total_cogs          = round(sum(o["cogs"] or 0 for o in completed), 2)
    total_cargo         = round(sum(o["cargo_price"] or 0 for o in completed), 2)

    kpis = {
        "net_revenue":       total_net_revenue,
        "gross_revenue":     total_gross_revenue,
        "total_orders":      total_orders,
        "completed_orders":  completed_count,
        "avg_order_value":   avg_order_value,
        "cancellation_rate": cancellation_rate,
        "total_commission":  total_commission,
        "total_cogs":        total_cogs,
        "total_cargo":       total_cargo,
    }

    # ── 4. Aylık gelir (son 6 ay) ────────────────────────────────────────────
    monthly: dict[str, dict] = defaultdict(lambda: {"net_revenue": 0.0, "gross_revenue": 0.0, "orders": 0})
    for o in completed:
        if not o.get("order_date"):
            continue
        # order_date: "YYYY-MM-DD" string
        ym = str(o["order_date"])[:7]   # "YYYY-MM"
        monthly[ym]["net_revenue"]   += o["net_revenue"] or 0
        monthly[ym]["gross_revenue"] += (o["sale_price"] or 0) * (o["quantity"] or 1)
        monthly[ym]["orders"]        += 1

    monthly_revenue = [
        {
            "month":         k,
            "net_revenue":   round(v["net_revenue"], 2),
            "gross_revenue": round(v["gross_revenue"], 2),
            "orders":        v["orders"],
        }
        for k, v in sorted(monthly.items())
    ]

    # ── 5. Sipariş durum dağılımı ────────────────────────────────────────────
    status_map: dict[str, dict] = defaultdict(lambda: {"count": 0, "net_revenue": 0.0})
    for o in orders:
        s = o["status"] or "unknown"
        status_map[s]["count"]       += 1
        status_map[s]["net_revenue"] += o["net_revenue"] or 0

    status_breakdown = [
        {
            "status":      k,
            "count":       v["count"],
            "net_revenue": round(v["net_revenue"], 2),
        }
        for k, v in sorted(status_map.items(), key=lambda x: -x[1]["count"])
    ]

    # ── 6. Kategori bazında gelir ────────────────────────────────────────────
    cat_map: dict[str, dict] = defaultdict(lambda: {"net_revenue": 0.0, "orders": 0})
    for o in completed:
        listing = listing_map.get(o["listing_id"], {})
        cat = listing.get("category") or "Diğer"
        cat_map[cat]["net_revenue"] += o["net_revenue"] or 0
        cat_map[cat]["orders"]      += 1

    category_revenue = [
        {
            "category":   k,
            "net_revenue": round(v["net_revenue"], 2),
            "orders":      v["orders"],
        }
        for k, v in sorted(cat_map.items(), key=lambda x: -x[1]["net_revenue"])
    ]

    # ── 7. En çok kazandıran 5 ilan ─────────────────────────────────────────
    listing_perf: dict[str, dict] = defaultdict(lambda: {"net_revenue": 0.0, "orders": 0, "title": "", "category": ""})
    for o in completed:
        lid = o["listing_id"]
        listing = listing_map.get(lid, {})
        listing_perf[lid]["net_revenue"] += o["net_revenue"] or 0
        listing_perf[lid]["orders"]      += 1
        listing_perf[lid]["title"]        = listing.get("title", "—")
        listing_perf[lid]["category"]     = listing.get("category", "—")

    top_listings = sorted(
        [{"listing_id": k, **v} for k, v in listing_perf.items()],
        key=lambda x: -x["net_revenue"]
    )[:5]
    for t in top_listings:
        t["net_revenue"] = round(t["net_revenue"], 2)

    return {
        "kpis":             kpis,
        "monthly_revenue":  monthly_revenue,
        "status_breakdown": status_breakdown,
        "category_revenue": category_revenue,
        "top_listings":     top_listings,
    }


@router.get("/context")
async def get_finance_context(current_user=Depends(get_current_user)):
    """
    Finans Asistanı için kapsamlı finansal bağlam.
    Orders + finance_records tablolarını birleştirir.
    """
    user_id = current_user.id

    # ── 1. Siparişler ────────────────────────────────────────────────────────
    orders_res = supabase.table("orders") \
        .select("sale_price, cargo_price, commission_amt, cogs, net_revenue, quantity, status, order_date") \
        .eq("seller_id", user_id).execute()
    orders = orders_res.data or []

    completed = [o for o in orders if o["status"] in ("delivered", "shipped")]

    gross_revenue          = sum((o["sale_price"] or 0) * (o["quantity"] or 1) for o in completed)
    net_revenue_from_sales = sum(o["net_revenue"] or 0 for o in completed)
    total_cogs             = sum(o["cogs"] or 0 for o in completed)
    total_commission       = sum(o["commission_amt"] or 0 for o in completed)
    total_cargo            = sum(o["cargo_price"] or 0 for o in completed)

    orders_summary = {
        "gross_revenue":          round(gross_revenue, 2),
        "net_revenue_from_sales": round(net_revenue_from_sales, 2),
        "total_cogs":             round(total_cogs, 2),
        "total_commission":       round(total_commission, 2),
        "total_cargo":            round(total_cargo, 2),
        "total_orders":           len(orders),
        "completed_orders":       len(completed),
    }

    # ── 2. Finance Records ───────────────────────────────────────────────────
    records_res = supabase.table("finance_records") \
        .select("type, amount, category, record_date") \
        .eq("user_id", user_id).execute()
    records = records_res.data or []

    income_records  = [r for r in records if r["type"] == "income"]
    expense_records = [r for r in records if r["type"] == "expense"]

    total_other_income = sum(r["amount"] or 0 for r in income_records)
    total_expense      = sum(r["amount"] or 0 for r in expense_records)

    # Gider kategorileri
    cat_exp: dict[str, dict] = defaultdict(lambda: {"total": 0.0, "count": 0})
    for r in expense_records:
        cat = r.get("category") or "Diğer"
        cat_exp[cat]["total"] += r["amount"] or 0
        cat_exp[cat]["count"] += 1

    expense_breakdown = sorted(
        [{"category": k, "total": round(v["total"], 2), "count": v["count"]}
         for k, v in cat_exp.items()],
        key=lambda x: -x["total"]
    )

    records_summary = {
        "total_income":  round(total_other_income, 2),
        "total_expense": round(total_expense, 2),
    }

    # ── 3. Gerçek Net Kâr ────────────────────────────────────────────────────
    true_net_profit = round(net_revenue_from_sales + total_other_income - total_expense, 2)

    # ── 4. Aylık nakit akışı ─────────────────────────────────────────────────
    monthly_orders: dict[str, float]  = defaultdict(float)
    for o in completed:
        if o.get("order_date"):
            ym = str(o["order_date"])[:7]
            monthly_orders[ym] += o["net_revenue"] or 0

    monthly_expenses: dict[str, float] = defaultdict(float)
    for r in expense_records:
        if r.get("record_date"):
            ym = str(r["record_date"])[:7]
            monthly_expenses[ym] += r["amount"] or 0

    all_months = sorted(set(list(monthly_orders.keys()) + list(monthly_expenses.keys())))
    monthly_cashflow = [
        {
            "month":      m,
            "orders_net": round(monthly_orders.get(m, 0), 2),
            "expenses":   round(monthly_expenses.get(m, 0), 2),
            "net":        round(monthly_orders.get(m, 0) - monthly_expenses.get(m, 0), 2),
        }
        for m in all_months[-6:]   # son 6 ay
    ]

    return {
        "orders_summary":   orders_summary,
        "records_summary":  records_summary,
        "true_net_profit":  true_net_profit,
        "expense_breakdown": expense_breakdown,
        "monthly_cashflow": monthly_cashflow,
        "period_months":    6,
    }


@router.post("/chat")
async def finance_chat(
    body: FinanceChatRequest,
    current_user=Depends(get_current_user),
):
    """Finans asistanı sohbet endpoint'i."""
    try:
        reply = await asyncio.to_thread(
            finance_assistant_chat,
            message = body.message,
            history = [m.model_dump() for m in body.history],
            context = body.context,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Asistan yanıt üretemedi: {str(e)}")

    return {"reply": reply}
