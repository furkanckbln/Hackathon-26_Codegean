"""
Finans Router

Endpoint'ler:
  GET    /finance/overview          — Genel Bakış
  GET    /finance/context           — Finans Asistanı bağlamı
  POST   /finance/chat              — Finans Asistanı sohbet
  GET    /finance/transactions      — Tüm finance_records (manuel + otomatik)
  POST   /finance/transactions      — Yeni manuel kayıt ekle
  DELETE /finance/transactions/{id} — Manuel kaydı sil
  GET    /finance/alerts            — Anomali tespit motoru
  POST   /finance/alerts/chat       — Alert bağlamlı zorunlu asistan sohbeti
"""

import asyncio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.routers.auth import get_current_user
from app.database.supabase_client import supabase
from app.services.gemini_service import finance_assistant_chat, alert_assistant_chat
from collections import defaultdict
from datetime import date, datetime, timedelta
from calendar import monthrange


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
        .select("type, amount, category, record_date, source, source_order_id, created_at") \
        .eq("user_id", user_id) \
        .execute()
    return res.data or []


def _record_ym(r: dict) -> str:
    """
    Kayıt için YYYY-MM döner.
    record_date NULL ise created_at'a düşer (trigger kayıtlarında record_date boş olabilir).
    """
    date_str = r.get("record_date") or r.get("created_at") or ""
    return str(date_str)[:7]


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
        ym = _record_ym(r)
        if not ym or len(ym) < 7:
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
        ym = _record_ym(r)
        if not ym or len(ym) < 7:
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

    # ── Kategori bazında marj (orders + listings) ────────────────────────────
    orders_res = supabase.table("orders") \
        .select("listing_id, sale_price, quantity, cogs, net_revenue, status") \
        .eq("seller_id", user_id) \
        .in_("status", ["delivered", "shipped"]).execute()
    orders_data = orders_res.data or []

    listings_res = supabase.table("listings") \
        .select("id, title, category, stock, sales_count, status") \
        .eq("user_id", user_id).execute()
    listing_map = {l["id"]: l for l in (listings_res.data or [])}

    cat_revenue: dict[str, float] = defaultdict(float)
    cat_cogs:    dict[str, float] = defaultdict(float)
    cat_orders_:  dict[str, int]  = defaultdict(int)
    for o in orders_data:
        lid = o["listing_id"]
        cat = listing_map.get(lid, {}).get("category", "Diğer") or "Diğer"
        rev = (o["sale_price"] or 0) * (o["quantity"] or 1)
        cat_revenue[cat] += rev
        cat_cogs[cat]    += o["cogs"] or 0
        cat_orders_[cat] += 1

    category_margins = sorted([
        {
            "category":   cat,
            "revenue":    round(cat_revenue[cat], 2),
            "cogs":       round(cat_cogs[cat], 2),
            "orders":     cat_orders_[cat],
            "margin_pct": round((cat_revenue[cat] - cat_cogs[cat]) / cat_revenue[cat] * 100, 1)
                          if cat_revenue[cat] > 0 else 0,
        }
        for cat in cat_revenue
    ], key=lambda x: -x["revenue"])[:8]

    # ── Sipariş sağlığı ──────────────────────────────────────────────────────
    all_orders_res = supabase.table("orders") \
        .select("status, sale_price, quantity") \
        .eq("seller_id", user_id).execute()
    all_orders = all_orders_res.data or []

    total_orders = len(all_orders)
    completed_   = sum(1 for o in all_orders if o["status"] in ("delivered", "shipped"))
    cancelled_   = sum(1 for o in all_orders if o["status"] == "cancelled")
    refunded_    = sum(1 for o in all_orders if o["status"] == "refunded")
    total_rev_c  = sum((o["sale_price"] or 0) * (o["quantity"] or 1)
                       for o in all_orders if o["status"] in ("delivered", "shipped"))

    order_health = {
        "total_orders":       total_orders,
        "completion_rate":    round(completed_ / total_orders * 100, 1) if total_orders else 0,
        "refund_cancel_rate": round((cancelled_ + refunded_) / total_orders * 100, 1) if total_orders else 0,
        "avg_basket":         round(total_rev_c / completed_, 2) if completed_ else 0,
    }

    # ── En kârlı 5 ilan ──────────────────────────────────────────────────────
    lperf: dict[str, dict] = defaultdict(lambda: {
        "net_revenue": 0.0, "orders": 0, "title": "", "category": ""
    })
    for o in orders_data:
        lid = o["listing_id"]
        lperf[lid]["net_revenue"] += o["net_revenue"] or 0
        lperf[lid]["orders"]      += 1
        lperf[lid]["title"]        = listing_map.get(lid, {}).get("title", "—")
        lperf[lid]["category"]     = listing_map.get(lid, {}).get("category", "—")

    top_profitable = sorted(
        [{"title": v["title"], "category": v["category"],
          "net_revenue": round(v["net_revenue"], 2), "orders": v["orders"]}
         for v in lperf.values()],
        key=lambda x: -x["net_revenue"]
    )[:5]

    # ── Yavaş dönen stok sayısı ───────────────────────────────────────────────
    slow_movers_count = sum(
        1 for l in (listings_res.data or [])
        if l.get("status") == "active"
        and (l.get("stock") or 0) > 5
        and (l.get("sales_count") or 0) < 5
    )

    return {
        "orders_summary":    orders_summary,
        "records_summary":   records_summary,
        "true_net_profit":   round(true_net_profit, 2),
        "expense_breakdown": expense_breakdown,
        "monthly_cashflow":  monthly_cashflow,
        "period_months":     6,
        # Zenginleştirilmiş alanlar (Gemini sistem promptu için)
        "category_margins":  category_margins,
        "order_health":      order_health,
        "top_profitable":    top_profitable,
        "slow_movers_count": slow_movers_count,
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


# ── Anomali Tespit Motoru ────────────────────────────────────────────────────

def _detect_anomalies(records: list, listings: list, reviews: list = None) -> list:
    """
    finance_records + listings verisiyle kural tabanlı anomali tespiti yapar.
    Her anomali: {id, type, title, detail, severity, metric, recommendation}
    severity: "low" | "medium" | "critical"
    """
    alerts = []
    today  = date.today()

    income  = [r for r in records if r["type"] == "income"]
    expense = [r for r in records if r["type"] == "expense"]

    def amt(lst): return sum(r["amount"] or 0 for r in lst)

    # ── Aylık gruplama yardımcısı ────────────────────────────────────────────
    def by_month(lst):
        m: dict[str, float] = defaultdict(float)
        for r in lst:
            ym = _record_ym(r)
            if ym and len(ym) >= 7:
                m[ym] += r["amount"] or 0
        return m

    inc_by_month = by_month(income)
    exp_by_month = by_month(expense)
    all_months   = sorted(set(list(inc_by_month) + list(exp_by_month)))

    # Son tamamlanmış 3 ay (bu ay dahil değil)
    this_month = today.strftime("%Y-%m")
    past_months = [m for m in all_months if m < this_month][-3:]
    this_month_inc = inc_by_month.get(this_month, 0)
    this_month_exp = exp_by_month.get(this_month, 0)

    # ── KURAL 1: Reklam / Gelir Oranı ───────────────────────────────────────
    marketing_exp = amt([r for r in expense if "Reklam" in (r.get("category") or "")])
    order_income  = amt([r for r in income  if r.get("source") == "order_income"])

    if order_income > 0:
        mkt_ratio = marketing_exp / order_income
        if mkt_ratio > 0.25:
            alerts.append({
                "id": "mkt_ratio_critical",
                "type": "marketing_ratio",
                "title": "Reklam Harcaması Kritik Seviyede",
                "detail": f"Reklam giderlerin sipariş gelirinizin %{round(mkt_ratio*100, 1)}'ini oluşturuyor. "
                          f"Sektör standardı en fazla %15 olmalı.",
                "severity": "critical",
                "metric": f"%{round(mkt_ratio*100, 1)} (₺{round(marketing_exp):,} / ₺{round(order_income):,})",
                "recommendation": "Düşük ROI'li kampanyaları hemen durdur, bütçeni en iyi dönüşüm sağlayan kanallara yönlendir."
            })
        elif mkt_ratio > 0.15:
            alerts.append({
                "id": "mkt_ratio_medium",
                "type": "marketing_ratio",
                "title": "Reklam / Gelir Oranı Yükseliyor",
                "detail": f"Reklam giderlerin gelirinizin %{round(mkt_ratio*100, 1)}'i. İdeal eşik %15.",
                "severity": "medium",
                "metric": f"%{round(mkt_ratio*100, 1)}",
                "recommendation": "Kampanya performansını gözden geçir, organik kanallara ağırlık ver."
            })

    # ── KURAL 2: Negatif Nakit Akışı Trendi ─────────────────────────────────
    if len(past_months) >= 2:
        nets = [inc_by_month.get(m, 0) - exp_by_month.get(m, 0) for m in past_months]
        negative_months = [n for n in nets if n < 0]
        declining = all(nets[i] > nets[i+1] for i in range(len(nets)-1))

        if len(negative_months) >= 2:
            alerts.append({
                "id": "negative_cashflow_critical",
                "type": "cashflow_trend",
                "title": "Art Arda Negatif Nakit Akışı",
                "detail": f"Son {len(negative_months)} ayda giderler gelirleri aştı. İşletme nakit rezervi eriyor.",
                "severity": "critical",
                "metric": f"Son aylık net: ₺{round(nets[-1]):,}",
                "recommendation": "Acil önlem: Ertelenebilir giderleri durdur, tahsilat süreçlerini hızlandır."
            })
        elif declining and len(nets) >= 2:
            alerts.append({
                "id": "cashflow_declining",
                "type": "cashflow_trend",
                "title": "Nakit Akışı Düşüş Trendinde",
                "detail": f"Son {len(past_months)} ayda aylık net kâr sürekli düşüyor.",
                "severity": "medium",
                "metric": " → ".join([f"₺{round(n):,}" for n in nets]),
                "recommendation": "Gider kalemlerini tek tek incele, en çok büyüyen kalemi tespit et."
            })

    # ── KURAL 3: Gider Spike Tespiti ────────────────────────────────────────
    if past_months:
        cat_monthly: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
        for r in expense:
            ym  = _record_ym(r)
            cat = r.get("category") or "Diğer"
            if ym and len(ym) >= 7:
                cat_monthly[cat][ym] += r["amount"] or 0

        for cat, month_data in cat_monthly.items():
            past_vals  = [month_data.get(m, 0) for m in past_months[:-1]] if len(past_months) > 1 else []
            this_val   = month_data.get(this_month, 0)
            past_avg   = sum(past_vals) / len(past_vals) if past_vals else 0

            if past_avg > 0 and this_val > 0:
                ratio = this_val / past_avg
                if ratio >= 3:
                    alerts.append({
                        "id": f"spike_critical_{cat[:10]}",
                        "type": "expense_spike",
                        "title": f"Kritik Gider Artışı: {cat}",
                        "detail": f"Bu ay '{cat}' harcaman geçmiş ortalamanın {round(ratio, 1)}x'i. "
                                  f"Ort: ₺{round(past_avg):,} → Bu ay: ₺{round(this_val):,}",
                        "severity": "critical",
                        "metric": f"{round(ratio, 1)}x artış",
                        "recommendation": f"'{cat}' kalemindeki bu artışın kaynağını derhal incele."
                    })
                elif ratio >= 2:
                    alerts.append({
                        "id": f"spike_medium_{cat[:10]}",
                        "type": "expense_spike",
                        "title": f"Gider Artışı: {cat}",
                        "detail": f"Bu ay '{cat}' harcaman geçmiş ortalamanın {round(ratio, 1)}x'i.",
                        "severity": "medium",
                        "metric": f"{round(ratio, 1)}x artış",
                        "recommendation": f"'{cat}' giderini gözden geçir."
                    })

    # ── KURAL 4: Kritik Stok Uyarısı ────────────────────────────────────────
    zero_stock    = [l for l in listings if (l.get("stock") or 0) == 0  and l.get("status") == "active"]
    low_stock     = [l for l in listings if 0 < (l.get("stock") or 0) <= 5 and l.get("status") == "active"]

    if zero_stock:
        alerts.append({
            "id": "zero_stock_critical",
            "type": "stock",
            "title": f"{len(zero_stock)} Aktif İlan Stok Tükendi",
            "detail": f"{', '.join(l['title'][:30] for l in zero_stock[:3])}{'...' if len(zero_stock)>3 else ''} "
                      f"{'ilanı' if len(zero_stock)==1 else 'ilanları'} stoku tükendi, satış kaybediyorsun.",
            "severity": "critical",
            "metric": f"{len(zero_stock)} ilan",
            "recommendation": "Bu ilanları hemen pasif yap veya acil stok yenile."
        })
    elif len(low_stock) >= 3:
        alerts.append({
            "id": "low_stock_medium",
            "type": "stock",
            "title": f"{len(low_stock)} İlanda Kritik Stok Seviyesi",
            "detail": f"{len(low_stock)} aktif ilanında 5 veya daha az ürün kaldı.",
            "severity": "medium",
            "metric": f"{len(low_stock)} ilan, stok ≤ 5",
            "recommendation": "Bu ürünler için stok siparişini hemen ver."
        })

    # ── KURAL 5: Nakit Açığı Tahmini (30/60/90 gün) ─────────────────────────
    if len(past_months) >= 2:
        avg_monthly_inc = sum(inc_by_month.get(m, 0) for m in past_months) / len(past_months)
        avg_monthly_exp = sum(exp_by_month.get(m, 0) for m in past_months) / len(past_months)
        avg_monthly_net = avg_monthly_inc - avg_monthly_exp

        # Mevcut ay neti + projeksiyon
        current_net = this_month_inc - this_month_exp
        proj_30  = current_net + avg_monthly_net * 1
        proj_60  = current_net + avg_monthly_net * 2
        proj_90  = current_net + avg_monthly_net * 3

        if proj_30 < 0:
            alerts.append({
                "id": "cashflow_gap_30",
                "type": "cashflow_projection",
                "title": "30 Gün İçinde Nakit Açığı Riski",
                "detail": f"Mevcut gelir/gider trendinde 30 gün sonra ₺{abs(round(proj_30)):,} açık oluşacak. "
                          f"Aylık ort. net: ₺{round(avg_monthly_net):,}",
                "severity": "critical",
                "metric": f"30g: ₺{round(proj_30):,} | 60g: ₺{round(proj_60):,} | 90g: ₺{round(proj_90):,}",
                "recommendation": "Nakit girişini hızlandır: tahsilatları öne çek, ertelenebilir ödemeleri ertele."
            })
        elif proj_60 < 0:
            alerts.append({
                "id": "cashflow_gap_60",
                "type": "cashflow_projection",
                "title": "60 Gün İçinde Nakit Açığı Riski",
                "detail": f"Mevcut trend devam ederse 60 günde nakit açığı oluşabilir.",
                "severity": "medium",
                "metric": f"30g: ₺{round(proj_30):,} | 60g: ₺{round(proj_60):,} | 90g: ₺{round(proj_90):,}",
                "recommendation": "Gider kontrolüne gir, gelir artırıcı aksiyonlar planla."
            })

    # ── KURAL 6: Düşük Ürün Puanı ───────────────────────────────────────────
    active_rated = [
        l for l in listings
        if l.get("status") == "active" and l.get("rating") is not None
    ]

    critical_rated = [l for l in active_rated if float(l["rating"]) < 2.0]
    medium_rated   = [l for l in active_rated if 2.0 <= float(l["rating"]) < 3.0]

    for l in critical_rated:
        alerts.append({
            "id":   f"low_rating_critical_{l['id']}",
            "type": "low_rating",
            "title": f"Kritik Düşük Puan: {l['title'][:45]}",
            "detail": (
                f"'{l['title'][:45]}' ilanının müşteri puanı "
                f"{float(l['rating']):.1f}/5 seviyesine düştü. "
                f"Müşteri memnuniyeti tehlikede, satışlarını olumsuz etkiliyor."
            ),
            "severity": "critical",
            "metric": f"{float(l['rating']):.1f} / 5",
            "recommendation": (
                "Bu ilana hemen göz at: müşteri yorumlarını oku, "
                "ürün açıklaması ve görsellerini güncelle, "
                "varsa kalite sorununu gider."
            ),
        })

    for l in medium_rated:
        alerts.append({
            "id":   f"low_rating_medium_{l['id']}",
            "type": "low_rating",
            "title": f"Düşük Puan Riski: {l['title'][:45]}",
            "detail": (
                f"'{l['title'][:45]}' ilanının ortalama puanı "
                f"{float(l['rating']):.1f}/5. "
                f"2.0'ın altına düşmeden önlem al."
            ),
            "severity": "medium",
            "metric": f"{float(l['rating']):.1f} / 5",
            "recommendation": (
                "Müşteri yorumlarını incele, ürün kalitesi veya "
                "açıklamasında iyileştirme yap."
            ),
        })

    # ── KURAL 6: Düşük Ürün Puanı ───────────────────────────────────────────
    active_rated = [
        l for l in listings
        if l.get("status") == "active" and l.get("rating") is not None
    ]

    critical_rated = [l for l in active_rated if float(l["rating"]) < 2.0]
    medium_rated   = [l for l in active_rated if 2.0 <= float(l["rating"]) < 3.0]

    for l in critical_rated:
        alerts.append({
            "id":   f"low_rating_critical_{l['id']}",
            "type": "low_rating",
            "title": f"Kritik Düşük Puan: {l['title'][:45]}",
            "detail": (
                f"'{l['title'][:45]}' ilanının müşteri puanı "
                f"{float(l['rating']):.1f}/5 seviyesine düştü. "
                f"Müşteri memnuniyeti tehlikede, satışlarını olumsuz etkiliyor."
            ),
            "severity": "critical",
            "metric": f"{float(l['rating']):.1f} / 5",
            "recommendation": (
                "Bu ilana hemen göz at: müşteri yorumlarını oku, "
                "ürün açıklaması ve görsellerini güncelle, "
                "varsa kalite sorununu gider."
            ),
        })

    for l in medium_rated:
        alerts.append({
            "id":   f"low_rating_medium_{l['id']}",
            "type": "low_rating",
            "title": f"Düşük Puan Riski: {l['title'][:45]}",
            "detail": (
                f"'{l['title'][:45]}' ilanının ortalama puanı "
                f"{float(l['rating']):.1f}/5. "
                f"2.0'ın altına düşmeden önlem al."
            ),
            "severity": "medium",
            "metric": f"{float(l['rating']):.1f} / 5",
            "recommendation": (
                "Müşteri yorumlarını incele, ürün kalitesi veya "
                "açıklamasında iyileştirme yap."
            ),
        })

    # ── KURAL 7: 1 Yıldız Yorum Uyarısı ────────────────────────────────────
    if reviews:
        # listing_id → title eşlemesi
        listing_map = {l["id"]: l["title"] for l in listings}

        # listing bazında 1 yıldızlı yorumları grupla
        one_star: dict[str, list] = {}
        for r in reviews:
            if r.get("rating") == 1:
                lid = r["listing_id"]
                one_star.setdefault(lid, []).append(r)

        for lid, rev_list in one_star.items():
            title    = listing_map.get(lid, "Bilinmeyen İlan")
            count    = len(rev_list)
            comments = [
                r["comment"] for r in rev_list if r.get("comment")
            ][:2]

            detail = (
                f"'{title[:45]}' ilanına {count} adet 1 yıldızlı yorum yapıldı. "
            )
            if comments:
                detail += f"Son yorum: \"{comments[0][:120]}\""

            alerts.append({
                "id":   f"one_star_review_{lid}",
                "type": "one_star_review",
                "title": f"1 Yıldızlı Yorum: {title[:45]}",
                "detail": detail,
                "severity": "critical",
                "metric": f"{count} adet 1★ yorum",
                "recommendation": (
                    "Bu yorumları hemen incele. Ürün açıklaması yanıltıcı olabilir "
                    "veya ciddi bir kalite sorunu var. Gerekirse ilanı güncelle ya da "
                    "geçici olarak pasife al."
                ),
            })

    # Severity sırasına göre sırala: critical > medium > low
    order = {"critical": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda a: order.get(a["severity"], 3))
    return alerts


@router.get("/reports")
async def get_reports(current_user=Depends(get_current_user)):
    """
    Raporlar sayfası — 4 bölüm:
      1. Kârlılık Özeti   — aylık net kâr trendi + aylık büyüme oranı + kategori marjları
      2. Gider Analizi    — kategori bazında aylık trend + reklam/gelir oranı trendi
      3. Sipariş Sağlığı  — tamamlanma/iade/iptal oranları + aylık sipariş adedi
      4. Ürün Performansı — en kârlı 5 ilan + yavaş dönen stoklar
    """
    user_id = current_user.id
    records = _load_finance_records(user_id)
    income  = [r for r in records if r["type"] == "income"]
    expense = [r for r in records if r["type"] == "expense"]

    def amt(lst): return sum(r["amount"] or 0 for r in lst)

    # ── Aylık net kâr trendi (son 6 ay) ─────────────────────────────────────
    monthly_inc: dict[str, float] = defaultdict(float)
    monthly_exp: dict[str, float] = defaultdict(float)
    for r in records:
        ym = _record_ym(r)
        if not ym or len(ym) < 7:
            continue
        if r["type"] == "income":
            monthly_inc[ym] += r["amount"] or 0
        else:
            monthly_exp[ym] += r["amount"] or 0

    all_months = sorted(set(list(monthly_inc) + list(monthly_exp)))[-6:]
    monthly_net = []
    for i, m in enumerate(all_months):
        net     = monthly_inc.get(m, 0) - monthly_exp.get(m, 0)
        inc     = monthly_inc.get(m, 0)
        exp     = monthly_exp.get(m, 0)
        prev    = monthly_inc.get(all_months[i-1], 0) - monthly_exp.get(all_months[i-1], 0) if i > 0 else None
        mom_pct = round((net - prev) / abs(prev) * 100, 1) if prev and prev != 0 else None
        monthly_net.append({
            "month":    m,
            "income":   round(inc, 2),
            "expense":  round(exp, 2),
            "net":      round(net, 2),
            "mom_pct":  mom_pct,   # aylık büyüme %
        })

    # Son ay büyüme özeti
    last_two = monthly_net[-2:] if len(monthly_net) >= 2 else []
    overall_mom = last_two[-1]["mom_pct"] if last_two else None

    # ── Kategori bazında kâr marjı ───────────────────────────────────────────
    orders_res = supabase.table("orders") \
        .select("listing_id, sale_price, quantity, cogs, net_revenue, status") \
        .eq("seller_id", user_id) \
        .in_("status", ["delivered", "shipped"]).execute()
    orders_data = orders_res.data or []

    listings_res = supabase.table("listings") \
        .select("id, title, category, cost_price, stock, sales_count") \
        .eq("user_id", user_id).execute()
    listing_map = {l["id"]: l for l in (listings_res.data or [])}

    cat_revenue: dict[str, float] = defaultdict(float)
    cat_cogs:    dict[str, float] = defaultdict(float)
    cat_orders:  dict[str, int]   = defaultdict(int)
    for o in orders_data:
        lid = o["listing_id"]
        cat = listing_map.get(lid, {}).get("category", "Diğer") or "Diğer"
        rev = (o["sale_price"] or 0) * (o["quantity"] or 1)
        cat_revenue[cat] += rev
        cat_cogs[cat]    += o["cogs"] or 0
        cat_orders[cat]  += 1

    category_margins = sorted([
        {
            "category": cat,
            "revenue":  round(cat_revenue[cat], 2),
            "cogs":     round(cat_cogs[cat], 2),
            "orders":   cat_orders[cat],
            "margin":   round((cat_revenue[cat] - cat_cogs[cat]) / cat_revenue[cat] * 100, 1)
                        if cat_revenue[cat] > 0 else 0,
        }
        for cat in cat_revenue
    ], key=lambda x: -x["revenue"])[:8]

    # ── Gider Analizi — top 4 kategori aylık trend ───────────────────────────
    top_exp_cats = [
        c["category"] for c in sorted(
            [{"category": k, "total": sum(r["amount"] or 0 for r in expense if (r.get("category") or "") == k)}
             for k in set(r.get("category") or "Diğer" for r in expense)],
            key=lambda x: -x["total"]
        )[:4]
    ]
    cat_trend = {cat: [] for cat in top_exp_cats}
    for m in all_months:
        for cat in top_exp_cats:
            val = sum(
                r["amount"] or 0 for r in expense
                if (r.get("category") or "Diğer") == cat and _record_ym(r) == m
            )
            cat_trend[cat].append({"month": m, "amount": round(val, 2)})

    expense_category_trend = [
        {"category": cat, "monthly": cat_trend[cat]}
        for cat in top_exp_cats
    ]

    # Reklam/Gelir oranı aylık trend
    order_income_by_month = defaultdict(float)
    ad_exp_by_month = defaultdict(float)
    for r in income:
        if r.get("source") == "order_income":
            ym = _record_ym(r)
            if ym and len(ym) >= 7:
                order_income_by_month[ym] += r["amount"] or 0
    for r in expense:
        if "Reklam" in (r.get("category") or ""):
            ym = _record_ym(r)
            if ym and len(ym) >= 7:
                ad_exp_by_month[ym] += r["amount"] or 0

    ad_ratio_trend = [
        {
            "month":    m,
            "ad_exp":   round(ad_exp_by_month.get(m, 0), 2),
            "income":   round(order_income_by_month.get(m, 0), 2),
            "ratio_pct": round(
                ad_exp_by_month.get(m, 0) / order_income_by_month.get(m, 1) * 100, 1
            ) if order_income_by_month.get(m, 0) > 0 else 0,
        }
        for m in all_months
    ]

    # ── Sipariş Sağlığı ──────────────────────────────────────────────────────
    all_orders_res = supabase.table("orders") \
        .select("status, sale_price, quantity, net_revenue") \
        .eq("seller_id", user_id).execute()
    all_orders = all_orders_res.data or []

    total_orders     = len(all_orders)
    delivered        = sum(1 for o in all_orders if o["status"] == "delivered")
    shipped          = sum(1 for o in all_orders if o["status"] == "shipped")
    cancelled        = sum(1 for o in all_orders if o["status"] == "cancelled")
    refunded         = sum(1 for o in all_orders if o["status"] == "refunded")
    processing       = sum(1 for o in all_orders if o["status"] == "processing")
    completed        = delivered + shipped
    total_revenue_orders = sum((o["sale_price"] or 0) * (o["quantity"] or 1) for o in all_orders if o["status"] in ("delivered", "shipped"))

    order_health = {
        "total_orders":       total_orders,
        "completed":          completed,
        "completion_rate":    round(completed / total_orders * 100, 1) if total_orders else 0,
        "cancelled":          cancelled,
        "refunded":           refunded,
        "refund_cancel_rate": round((cancelled + refunded) / total_orders * 100, 1) if total_orders else 0,
        "processing":         processing,
        "avg_basket":         round(total_revenue_orders / completed, 2) if completed else 0,
    }

    # ── Ürün Performansı ─────────────────────────────────────────────────────
    lperf: dict[str, dict] = defaultdict(lambda: {
        "net_revenue": 0.0, "orders": 0, "title": "", "category": "", "cogs": 0.0
    })
    for o in orders_data:
        lid = o["listing_id"]
        lperf[lid]["net_revenue"] += o["net_revenue"] or 0
        lperf[lid]["orders"]      += 1
        lperf[lid]["cogs"]        += o["cogs"] or 0
        lperf[lid]["title"]        = listing_map.get(lid, {}).get("title", "—")
        lperf[lid]["category"]     = listing_map.get(lid, {}).get("category", "—")

    top_profitable = sorted(
        [{"listing_id": k, **v,
          "net_revenue": round(v["net_revenue"], 2),
          "profit_per_order": round(v["net_revenue"] / v["orders"], 2) if v["orders"] else 0}
         for k, v in lperf.items()],
        key=lambda x: -x["net_revenue"]
    )[:5]

    # Yavaş dönen stoklar: aktif, stok > 5, satış < 5
    slow_movers = sorted([
        {
            "listing_id": l["id"],
            "title":      l["title"],
            "category":   l.get("category", "—"),
            "stock":      l.get("stock", 0),
            "sales_count": l.get("sales_count", 0),
        }
        for l in (listings_res.data or [])
        if l.get("status") == "active"
        and (l.get("stock") or 0) > 5
        and (l.get("sales_count") or 0) < 5
    ], key=lambda x: -x["stock"])[:5]

    return {
        "profitability": {
            "monthly_net":     monthly_net,
            "overall_mom_pct": overall_mom,
            "category_margins": category_margins,
        },
        "expense_analysis": {
            "category_trend":  expense_category_trend,
            "ad_ratio_trend":  ad_ratio_trend,
            "top_expense_cats": top_exp_cats,
        },
        "order_health": order_health,
        "product_performance": {
            "top_profitable": top_profitable,
            "slow_movers":    slow_movers,
        },
    }


class AlertChatRequest(BaseModel):
    message:  str
    history:  List[FinanceChatMessage] = []
    alerts:   List[dict] = []
    context:  dict = {}


@router.get("/alerts")
async def get_alerts(current_user=Depends(get_current_user)):
    """Anomali tespit motoru — finance_records + listings + reviews analiz eder."""
    user_id = current_user.id

    records  = _load_finance_records(user_id)
    lst_res  = supabase.table("listings") \
        .select("id, title, stock, status, sales_count, rating") \
        .eq("user_id", user_id).execute()
    listings = lst_res.data or []

    # Satıcıya ait ilanlara yapılan yorumları çek (1 yıldız tespiti için)
    listing_ids = [l["id"] for l in listings]
    reviews: list = []
    if listing_ids:
        rev_res = supabase.table("reviews") \
            .select("listing_id, rating, comment, created_at") \
            .in_("listing_id", listing_ids) \
            .execute()
        reviews = rev_res.data or []

    alerts = _detect_anomalies(records, listings, reviews)

    has_critical = any(a["severity"] == "critical" for a in alerts)
    return {
        "alerts":       alerts,
        "has_critical": has_critical,
        "checked_at":   datetime.utcnow().isoformat(),
    }


@router.post("/alerts/chat")
async def alerts_chat(
    body: AlertChatRequest,
    current_user=Depends(get_current_user),
):
    """Alert bağlamlı zorunlu asistan sohbeti."""
    try:
        reply = await asyncio.to_thread(
            alert_assistant_chat,
            message = body.message,
            history = [m.model_dump() for m in body.history],
            alerts  = body.alerts,
            context = body.context,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Asistan yanıt üretemedi: {str(e)}")

    return {"reply": reply}
