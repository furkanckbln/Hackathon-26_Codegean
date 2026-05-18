"""
Reviews Router — Müşteri Yorum & Puan

Endpoint'ler:
  POST /reviews             — Yorum yaz (auth gerekli, buyer_id eşleşmeli)
  GET  /reviews/order/{id}  — Siparişe ait yorum var mı? (müşteri kontrol)
  GET  /reviews/listing/{id}— İlana ait tüm yorumlar (vitrin için)
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional

from app.database.supabase_client import supabase
from app.routers.auth import get_current_user

router = APIRouter()


class ReviewCreate(BaseModel):
    order_id:   str
    rating:     int   = Field(..., ge=1, le=5)
    comment:    Optional[str] = Field(default=None, max_length=1000)


@router.post("/", status_code=201)
async def create_review(body: ReviewCreate, current_user=Depends(get_current_user)):
    """
    Müşteri siparişine yorum + puan ekler.
    - Sipariş 'delivered' statüsünde olmalı
    - Siparişin buyer_id'si giriş yapan kullanıcıyla eşleşmeli
    - Aynı siparişe yalnızca 1 yorum yapılabilir (UNIQUE constraint)
    """

    # ── 1. Siparişi doğrula ─────────────────────────────────────────────────
    order_res = (
        supabase.table("orders")
        .select("id, buyer_id, seller_id, listing_id, status")
        .eq("id", body.order_id)
        .single()
        .execute()
    )

    if not order_res.data:
        raise HTTPException(status_code=404, detail="Sipariş bulunamadı.")

    order = order_res.data

    if str(order["buyer_id"]) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Bu siparişe yorum yapamazsınız.")

    if order["status"] != "delivered":
        raise HTTPException(
            status_code=400,
            detail="Yalnızca teslim edilmiş siparişlere yorum yapılabilir."
        )

    # ── 2. Daha önce yorum yapılmış mı? ────────────────────────────────────
    existing = (
        supabase.table("reviews")
        .select("id")
        .eq("order_id", body.order_id)
        .execute()
    )

    if existing.data:
        raise HTTPException(status_code=409, detail="Bu siparişe zaten yorum yaptınız.")

    # ── 3. Yorumu kaydet ────────────────────────────────────────────────────
    review_row = {
        "order_id":   body.order_id,
        "listing_id": order["listing_id"],
        "buyer_id":   str(current_user.id),
        "seller_id":  order["seller_id"],
        "rating":     body.rating,
        "comment":    body.comment or "",
    }

    res = supabase.table("reviews").insert(review_row).execute()

    if not res.data:
        raise HTTPException(status_code=500, detail="Yorum kaydedilemedi.")

    return {
        "id":      res.data[0]["id"],
        "message": "Yorumunuz başarıyla kaydedildi.",
    }


@router.get("/order/{order_id}")
async def get_review_by_order(order_id: str, current_user=Depends(get_current_user)):
    """Siparişe ait yorumu döndürür. Yorum yoksa 404."""
    res = (
        supabase.table("reviews")
        .select("id, rating, comment, created_at")
        .eq("order_id", order_id)
        .eq("buyer_id", str(current_user.id))
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="Henüz yorum yapılmamış.")

    return res.data[0]


@router.get("/listing/{listing_id}")
async def get_reviews_by_listing(listing_id: str):
    """İlana ait tüm yorumları döndürür (vitrin sayfası için, public)."""
    res = (
        supabase.table("reviews")
        .select("id, rating, comment, created_at, buyer_id")
        .eq("listing_id", listing_id)
        .order("created_at", desc=True)
        .execute()
    )

    return res.data or []
