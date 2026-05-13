"""
Finans Router

Endpoint'ler:
  GET    /finance/overview          — Genel Bakış
  GET    /finance/context           — Finans Asistanı bağlamı
  POST   /finance/chat              — Finans Asistanı sohbet
  GET    /finance/transactions      — Tüm finance_records (manuel + otomatik)
  POST   /finance/transactions      — Yeni manuel kayıt ekle
  DELETE /finance/transactions/{id} — Manuel kaydı sil
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


def _load_finance_records(user_id: str) -> list:
    """Tek yerde finance_records'ı çek — tüm endpoint'ler bunu kullanır."""
    res = supabase.table("finance_records") \
        .select("type, amount, category, record_date, source, source_order_id") \
        .eq("user_id", user_id) \
        .execute()
    return res.data or []


@router.get("/overview")
async def get_overview(current_user=Depends(get_current_user)):
    """
    Genel Bakış — tek kaynak: finance_records.
    Otomatik (sipariş) + manuel kayıtların tamamından hesaplanır.
    """
    user_id = current_user.id
    records = _load_finance_records(user_id)

    income  = [r for r in records if r["type"] == "income"]
    expense = [r for r in records if r["type"] == "expense"]

    # ── Kaynak bazlı gruplar ─────────────────────────────────────────────────
    def amt(lst): return sum(r["amount"] or 0 for r in lst)

    gross_revenue  = amt([r for r in income  if r["source"] == "order_income"])
    total_cogs     = amt([r for r in expense if r["source"] == "order_cogs"])
    total_commission = amt([r for r in expense if r["source"] == "order_commission"])
    total_cargo    = amt([r for r in expense if r["source"] == "order_cargo"])
    other_income   = amt([r for r in income  if r["source"] not in ("order_income",)])
    manual_expense = amt([r for r in expense if r["source"] == "manual"])

    net_from_sales = gross_revenue - total_cogs - total_commission - total_cargo
    total_income   = amt(income)
    total_expense  = amt(expense)
    true_net       = total_income - total_expense

    gross_margin = round(net_from_sales / gross_revenue * 100, 1) if gross_revenue else 0

    kpis = {
        "gross_revenue":     round(gross_revenue, 2),
        "net_revenue":       round(net_from_sales, 2),   # satış net geliri
        "true_net_profit":   round(true_net, 2),          # gerçek net kâr
        "total_income":      round(total_income, 2),
        "total_expense":     round(total_expense, 2),
        "total_cogs":        round(total_cogs, 2),
        "total_commission":  round(total_commission, 2),
        "total_cargo":       round(total_cargo, 2),
        "other_income":      round(other_income, 2),
        "manual_expense":    round(manual_expense, 2),
        "gross_margin":      gross_margin,
    }

    # ── Aylık gelir/gider (son 6 ay) ─────────────────────────────────────────
    monthly_inc: dict[str, float] = defaultdict(float)
    monthly_exp: dict[str, float] = defaultdict(float)
    for r in records:
        ym = str(r.get("record_date") or "")[:7]
        if not ym:
            continue
        if r["type"] == "income":
            monthly_inc[ym] += r["amount"] or 0
        else:
            monthly_exp[ym] += r["amount"] or 0

    all_months = sorted(set(list(monthly_inc) + list(monthly_exp)))[-6:]
    monthly_revenue = [
        {
            "month":       m,
            "income":      round(monthly_inc.get(m, 0), 2),
            "expense":     round(monthly_exp.get(m, 0), 2),
            "net_revenue": round(monthly_inc.get(m, 0) - monthly_exp.get(m, 0), 2),
        }
        for m in all_months
    ]

    # ── Gider dağılımı (stacked bar için) ────────────────────────────────────
    cost_breakdown = [
        {"label": "Ürün Maliyeti (COGS)", "value": round(total_cogs, 2),        "key": "cogs"       },
        {"label": "Platform Komisyonu",   "value": round(total_commission, 2),   "key": "commission" },
        {"label": "Kargo",                "value": round(total_cargo, 2),        "key": "cargo"      },
        {"label": "Operasyonel Giderler", "value": round(manual_expense, 2),     "key": "opex"       },
        {"label": "Net Kâr",              "value": round(true_net, 2),           "key": "profit"     },
    ]

    # ── Kategori bazında gider ────────────────────────────────────────────────
    cat_exp: dict[str, float] = defaultdict(float)
    for r in expense:
        cat_exp[r["category"] or "Diğer"] += r["amount"] or 0

    category_expense = sorted(
        [{"category": k, "total": round(v, 2)} for k, v in cat_exp.items()],
        key=lambda x: -x["total"]
    )[:8]

    # ── Sipariş durum dağılımı — hâlâ orders tablosundan (operasyonel metrik) ─
    orders_res = supabase.table("orders") \
        .select("status, net_revenue") \
        .eq("seller_id", user_id).execute()
    orders_data = orders_res.data or []
    status_map: dict[str, dict] = defaultdict(lambda: {"count": 0, "net_revenue": 0.0})
    for o in orders_data:
        s = o["status"] or "unknown"
        status_map[s]["count"]       += 1
        status_map[s]["net_revenue"] += o["net_revenue"] or 0
    status_breakdown = sorted(
        [{"status": k, "count": v["count"], "net_revenue": round(v["net_revenue"], 2)}
         for k, v in status_map.items()],
        key=lambda x: -x["count"]
    )

    # ── Top 5 ilan — orders + listings (operasyonel metrik) ──────────────────
    listings_res = supabase.table("listings") \
        .select("id, title, category").eq("user_id", user_id).execute()
    listing_map = {l["id"]: l for l in (listings_res.data or [])}

    completed_orders = [o for o in orders_data if o["status"] in ("delivered", "shipped")]
    # orders tablosunda listing_id lazım, ayrı sorgu
    orders_full_res = supabase.table("orders") \
        .select("listing_id, net_revenue, status") \
        .eq("seller_id", user_id) \
        .in_("status", ["delivered", "shipped"]).execute()
    lperf: dict[str, dict] = defaultdict(lambda: {"net_revenue": 0.0, "orders": 0, "title": "", "category": ""})
    for o in (orders_full_res.data or []):
        lid = o["listing_id"]
        lperf[lid]["net_revenue"] += o["net_revenue"] or 0
        lperf[lid]["orders"]      += 1
        lperf[lid]["title"]        = listing_map.get(lid, {}).get("title", "—")
        lperf[lid]["category"]     = listing_map.get(lid, {}).get("category", "—")
    top_listings = sorted(
        [{"listing_id": k, **v, "net_revenue": round(v["net_revenue"], 2)} for k, v in lperf.items()],
        key=lambda x: -x["net_revenue"]
    )[:5]

    return {
        "kpis":             kpis,
        "monthly_revenue":  monthly_revenue,
        "cost_breakdown":   cost_breakdown,
        "category_expense": category_expense,
        "status_breakdown": status_breakdown,
        "top_listings":     top_listings,
    }


@router.get("/context")
async def get_finance_context(current_user=Depends(get_current_user)):
    """
    Finans Asistanı için kapsamlı finansal bağlam.
    Tek kaynak: finance_records (otomatik + manuel).
    """
    user_id = current_user.id
    records = _load_finance_records(user_id)

    income  = [r for r in records if r["type"] == "income"]
    expense = [r for r in records if r["type"] == "expense"]

    def amt(lst): return sum(r["amount"] or 0 for r in lst)

    # ── Kaynak bazlı özet ────────────────────────────────────────────────────
    gross_revenue    = amt([r for r in income  if r["source"] == "order_income"])
    total_cogs       = amt([r for r in expense if r["source"] == "order_cogs"])
    total_commission = amt([r for r in expense if r["source"] == "order_commission"])
    total_cargo      = amt([r for r in expense if r["source"] == "order_cargo"])
    other_income     = amt([r for r in income  if r["source"] != "order_income"])
    manual_expense   = amt([r for r in expense if r["source"] == "manual"])

    net_from_sales = gross_revenue - total_cogs - total_commission - total_cargo
    total_income   = amt(income)
    total_expense  = amt(expense)
    true_net_profit = total_income - total_expense

    orders_summary = {
        "gross_revenue":          round(gross_revenue, 2),
        "net_revenue_from_sales": round(net_from_sales, 2),
        "total_cogs":             round(total_cogs, 2),
        "total_commission":       round(total_commission, 2),
        "total_cargo":            round(total_cargo, 2),
    }
    records_summary = {
        "total_income":   round(total_income, 2),
        "total_expense":  round(total_expense, 2),
        "other_income":   round(other_income, 2),
        "manual_expense": round(manual_expense, 2),
    }

    # ── Gider kategorileri ───────────────────────────────────────────────────
    cat_exp: dict[str, dict] = defaultdict(lambda: {"total": 0.0, "count": 0})
    for r in expense:
        cat = r.get("category") or "Diğer"
        cat_exp[cat]["total"] += r["amount"] or 0
        cat_exp[cat]["count"] += 1

    expense_breakdown = sorted(
        [{"category": k, "total": round(v["total"], 2), "count": v["count"]}
         for k, v in cat_exp.items()],
        key=lambda x: -x["total"]
    )

    # ── Aylık nakit akışı ────────────────────────────────────────────────────
    monthly_inc: dict[str, float] = defaultdict(float)
    monthly_exp: dict[str, float] = defaultdict(float)
    for r in records:
        ym = str(r.get("record_date") or "")[:7]
        if not ym:
            continue
        if r["type"] == "income":
            monthly_inc[ym] += r["amount"] or 0
        else:
            monthly_exp[ym] += r["amount"] or 0

    all_months = sorted(set(list(monthly_inc) + list(monthly_exp)))[-6:]
    monthly_cashflow = [
        {
            "month":      m,
            "orders_net": round(monthly_inc.get(m, 0), 2),   # artık tüm gelir
            "expenses":   round(monthly_exp.get(m, 0), 2),
            "net":        round(monthly_inc.get(m, 0) - monthly_exp.get(m, 0), 2),
        }
        for m in all_months
    ]

    return {
        "orders_summary":    orders_summary,
        "records_summary":   records_summary,
        "true_net_profit":   round(true_net_profit, 2),
        "expense_breakdown": expense_breakdown,
        "monthly_cashflow":  monthly_cashflow,
        "period_months":     6,
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


# ── Transactions CRUD ────────────────────────────────────────────────────────

# Manuel kayıt eklemek için izin verilen source değerleri
MANUAL_SOURCES = {None, "", "manual"}

class TransactionCreate(BaseModel):
    type:        str            # "income" | "expense"
    amount:      float
    category:    str
    description: str = ""
    record_date: str            # "YYYY-MM-DD"


@router.get("/transactions")
async def list_transactions(current_user=Depends(get_current_user)):
    """
    Tüm finance_records'ı döndürür (manuel + trigger kaynaklı otomatikler).
    record_date azalan sırada (en yeni üstte).
    """
    res = supabase.table("finance_records") \
        .select("id, type, amount, category, description, record_date, source, source_order_id, created_at") \
        .eq("user_id", current_user.id) \
        .order("record_date", desc=True) \
        .order("created_at", desc=True) \
        .execute()
    return res.data or []


@router.post("/transactions", status_code=201)
async def create_transaction(
    body: TransactionCreate,
    current_user=Depends(get_current_user),
):
    """Manuel gelir/gider kaydı ekle."""
    if body.type not in ("income", "expense"):
        raise HTTPException(status_code=422, detail="type 'income' veya 'expense' olmalı.")
    if body.amount <= 0:
        raise HTTPException(status_code=422, detail="amount sıfırdan büyük olmalı.")

    row = {
        "user_id":     current_user.id,
        "type":        body.type,
        "amount":      round(body.amount, 2),
        "category":    body.category,
        "description": body.description,
        "record_date": body.record_date,
        "source":      "manual",
    }
    res = supabase.table("finance_records").insert(row).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Kayıt eklenemedi.")
    return res.data[0]


@router.delete("/transactions/{record_id}", status_code=204)
async def delete_transaction(
    record_id: str,
    current_user=Depends(get_current_user),
):
    """
    Manuel kaydı siler. Otomatik (trigger kaynaklı) kayıtlar silinemez.
    """
    # Kaydı çek — hem sahiplik hem kaynak kontrolü
    res = supabase.table("finance_records") \
        .select("id, source, user_id") \
        .eq("id", record_id) \
        .eq("user_id", current_user.id) \
        .single() \
        .execute()

    record = res.data
    if not record:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı.")

    # Otomatik kayıtları silmeye izin verme
    if record.get("source") and record["source"] not in MANUAL_SOURCES:
        raise HTTPException(
            status_code=403,
            detail="Otomatik oluşturulan kayıtlar silinemez."
        )

    supabase.table("finance_records") \
        .delete() \
        .eq("id", record_id) \
        .eq("user_id", current_user.id) \
        .execute()

    return None
