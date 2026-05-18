"""
Orders Router — Müşteri Sipariş Oluşturma

Endpoint'ler:
  POST /orders   — Müşteri siparişi oluştur (auth gerektirmez)
  GET  /orders/listing/{listing_id} — Belirli ilana ait son siparişler

Kargo Mantığı (listing.cargo_price):
  > 0 : Müşteri öder  → toplam fiyata eklenir, satıcı gideri yok
  = 0 : Ücretsiz kargo → satıcı üstlenir ama gider kaydı tutulmaz
  < 0 : Satıcı karşılar → abs(cargo_price) tutarında finance_records'a
        anında 'order_cargo' expense kaydı eklenir

Finance trigger (trg_order_finance_sync) artık order_cargo OLUŞTURMUYOR.
Negatif kargo gideri bu router tarafından sipariş anında yazılır.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date

from app.database.supabase_client import supabase
from app.routers.auth import get_current_user

router = APIRouter()

COMMISSION_RATE = 0.08    # %8 platform komisyonu


class OrderCreate(BaseModel):
    listing_id:  str
    quantity:    int            = Field(default=1, ge=1, le=100)
    buyer_name:  str            = Field(default="Misafir Müşteri", max_length=100)
    buyer_email: str            = Field(default="", max_length=200)
    buyer_id:    Optional[str]  = None   # giriş yapmış müşteri → bakiye düşülür


@router.post("/", status_code=201)
async def create_order(body: OrderCreate):
    """
    Müşteri siparişi oluştur.
    Auth gerektirmez — vitrinden gelen public istek.
    """

    # ── 1. İlanı çek ────────────────────────────────────────────────────────
    res = (
        supabase.table("listings")
        .select("id, user_id, title, price, cost_price, cargo_price, stock, status")
        .eq("id", body.listing_id)
        .single()
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="İlan bulunamadı.")

    listing = res.data

    if listing.get("status") != "active":
        raise HTTPException(status_code=400, detail="Bu ilan şu an satışta değil.")

    current_stock = listing.get("stock") or 0
    if current_stock < body.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Yetersiz stok. Mevcut: {current_stock} adet."
        )

    # ── 2. Fiyat & kâr hesapları ─────────────────────────────────────────────
    sale_price  = float(listing.get("price")      or 0)
    cost_price  = float(listing.get("cost_price") or 0)
    cargo_price = float(
        listing.get("cargo_price") if listing.get("cargo_price") is not None else 29.90
    )

    commission_amt = round(sale_price * body.quantity * COMMISSION_RATE, 2)
    cogs           = round(cost_price * body.quantity, 2)

    # Satıcı kargo gideri: yalnızca negatif cargo_price'ta
    seller_cargo_cost = round(abs(cargo_price), 2) if cargo_price < 0 else 0.0

    net_revenue = round(
        sale_price * body.quantity - commission_amt - cogs - seller_cargo_cost,
        2
    )

    # ── 3. Siparişi kaydet ───────────────────────────────────────────────────
    order_row = {
        "seller_id":       listing["user_id"],
        "listing_id":      body.listing_id,
        "buyer_id":        body.buyer_id,     # NULL → misafir müşteri
        "quantity":        body.quantity,
        "sale_price":      sale_price,
        "cargo_price":     cargo_price,       # olduğu gibi sakla (negatif olabilir)
        "commission_rate": COMMISSION_RATE,
        "commission_amt":  commission_amt,
        "cogs":            cogs,
        "net_revenue":     net_revenue,
        "status":          "processing",
        "order_date":      str(date.today()),
    }

    order_res = supabase.table("orders").insert(order_row).execute()

    if not order_res.data:
        raise HTTPException(status_code=500, detail="Sipariş oluşturulamadı.")

    created = order_res.data[0]

    # ── 4. Müşteriye gösterilecek toplam (bakiye düşmeden önce hesaplanmalı) ─
    customer_cargo = round(cargo_price, 2) if cargo_price > 0 else 0.0
    total = round(sale_price * body.quantity + customer_cargo, 2)

    # ── 5. Müşteri bakiyesinden düş ─────────────────────────────────────────
    #    buyer_id varsa → deduct_balance RPC çağır
    if body.buyer_id:
        try:
            supabase.rpc(
                "deduct_balance",
                {"p_user_id": body.buyer_id, "p_amount": total},
            ).execute()
        except Exception:
            raise HTTPException(
                status_code=402,
                detail=f"Yetersiz bakiye. Sipariş toplam: {total:.2f} ₺. Lütfen bakiye yükle.",
            )

    # ── 6. Satıcı kargo giderini anında finance_records'a yaz ───────────────
    #    Yalnızca cargo_price < 0 → satıcı öder durumunda
    if cargo_price < 0:
        supabase.table("finance_records").insert({
            "user_id":         listing["user_id"],
            "type":            "expense",
            "amount":          seller_cargo_cost,
            "category":        "Kargo",
            "description":     f"Kargo gideri (satıcı karşıladı) — {listing.get('title', '')}",
            "record_date":     str(date.today()),
            "source":          "order_cargo",
            "source_order_id": created["id"],
        }).execute()

    return {
        "order_id":    created["id"],
        "listing_id":  body.listing_id,
        "title":       listing.get("title", ""),
        "quantity":    body.quantity,
        "sale_price":  sale_price,
        "cargo_price": customer_cargo,
        "total":       total,
        "status":      "processing",
        "order_date":  str(date.today()),
        "message":     "Siparişiniz başarıyla alındı! Kargoya verildiğinde bildirim alacaksınız.",
    }


@router.get("/my")
async def get_my_orders(current_user=Depends(get_current_user)):
    """Giriş yapan müşterinin tüm siparişlerini döndürür."""
    res = (
        supabase.table("orders")
        .select(
            "id, quantity, sale_price, cargo_price, status, order_date, created_at, "
            "listing_id, listings(title, clean_image_url, category)"
        )
        .eq("buyer_id", str(current_user.id))
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


@router.get("/seller")
async def get_seller_orders(current_user=Depends(get_current_user)):
    """Giriş yapan satıcının tüm siparişlerini döndürür."""
    res = (
        supabase.table("orders")
        .select(
            "id, quantity, sale_price, cargo_price, net_revenue, status, "
            "order_date, created_at, listing_id, buyer_id, "
            "listings(title, clean_image_url, category)"
        )
        .eq("seller_id", str(current_user.id))
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


VALID_STATUSES = {"processing", "shipped", "delivered", "cancelled", "refunded"}

class StatusUpdate(BaseModel):
    status: str

@router.patch("/{order_id}/status")
async def update_order_status(
    order_id: str,
    body: StatusUpdate,
    current_user=Depends(get_current_user),
):
    """Satıcı sipariş durumunu günceller."""
    if body.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Geçersiz statü. Geçerli değerler: {', '.join(VALID_STATUSES)}"
        )

    # Siparişin bu satıcıya ait olduğunu doğrula
    check = (
        supabase.table("orders")
        .select("id, seller_id")
        .eq("id", order_id)
        .single()
        .execute()
    )
    if not check.data:
        raise HTTPException(status_code=404, detail="Sipariş bulunamadı.")
    if str(check.data["seller_id"]) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Bu siparişi güncelleme yetkiniz yok.")

    supabase.table("orders").update({"status": body.status}).eq("id", order_id).execute()
    return {"order_id": order_id, "status": body.status}


@router.get("/listing/{listing_id}")
async def get_listing_orders(listing_id: str):
    """İlana ait son 10 siparişi döndürür (seller dashboard için)."""
    res = (
        supabase.table("orders")
        .select("id, quantity, sale_price, cargo_price, status, order_date, created_at")
        .eq("listing_id", listing_id)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    return res.data or []
