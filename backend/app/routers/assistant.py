"""
Satış Asistanı Router

Endpoint'ler:
  GET /assistant/summary — Satıcıya özel hızlı özet (kendi ilanları + sektör kıyası)
"""

import asyncio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from app.routers.auth import get_current_user
from app.database.supabase_client import supabase
from app.services.gemini_service import sales_assistant_chat


class ChatMessage(BaseModel):
    role: str   # "user" | "ai"
    text: str

class AssistantChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    context: dict = {}

router = APIRouter()


@router.get("/summary")
async def get_summary(current_user=Depends(get_current_user)):
    """
    Satıcının dashboard özeti için gerekli tüm verileri tek sorguda döndürür.

    Dönen veri:
      - my_stats       : toplam ilan, toplam satış, ortalama puan
      - top_listings   : satıcının en çok satan 3 ilanı
      - low_stock      : stoğu 5 veya altına düşmüş ilanlar
      - category_avgs  : her kategorinin sektör geneli ort. fiyat, satış, puan
      - top_sector     : platformdaki en çok satan 5 ilan
    """

    user_id = current_user.id

    # ── 1. Satıcının tüm ilanları ─────────────────────────────────────────────
    my_res = supabase.table("listings")\
        .select("id, title, category, price, stock, sales_count, rating, status, clean_image_url")\
        .eq("user_id", user_id)\
        .execute()
    my_listings = my_res.data or []

    # ── 2. Satıcı genel istatistikleri ───────────────────────────────────────
    active_listings = [l for l in my_listings if l["status"] == "active"]
    total_sales     = sum(l.get("sales_count") or 0 for l in my_listings)
    rated_listings  = [l for l in my_listings if l.get("rating") is not None]
    avg_rating      = (
        round(sum(l["rating"] for l in rated_listings) / len(rated_listings), 2)
        if rated_listings else None
    )

    my_stats = {
        "total_listings":  len(my_listings),
        "active_listings": len(active_listings),
        "total_sales":     total_sales,
        "avg_rating":      avg_rating,
    }

    # ── 3. En çok satan 3 ilan ────────────────────────────────────────────────
    top_listings = sorted(
        my_listings,
        key=lambda l: l.get("sales_count") or 0,
        reverse=True
    )[:3]

    # ── 4. Stok uyarısı (stok <= 5, aktif ilanlar) ───────────────────────────
    low_stock = [
        l for l in active_listings
        if (l.get("stock") or 0) <= 5
    ]

    # ── 5. Tüm platform ilanları (sektör analizi için) ───────────────────────
    all_res = supabase.table("listings")\
        .select("category, price, sales_count, rating")\
        .eq("status", "active")\
        .execute()
    all_listings = all_res.data or []

    # Kategoriye göre grupla
    category_map = {}
    for listing in all_listings:
        cat = listing.get("category") or "Diğer"
        if cat not in category_map:
            category_map[cat] = {"prices": [], "sales": [], "ratings": []}
        if listing.get("price"):
            category_map[cat]["prices"].append(float(listing["price"]))
        if listing.get("sales_count"):
            category_map[cat]["sales"].append(listing["sales_count"])
        if listing.get("rating"):
            category_map[cat]["ratings"].append(float(listing["rating"]))

    category_avgs = {}
    for cat, data in category_map.items():
        category_avgs[cat] = {
            "avg_price":  round(sum(data["prices"])  / len(data["prices"]),  2) if data["prices"]  else None,
            "avg_sales":  round(sum(data["sales"])   / len(data["sales"]),   1) if data["sales"]   else None,
            "avg_rating": round(sum(data["ratings"]) / len(data["ratings"]), 2) if data["ratings"] else None,
            "listing_count": len(data["prices"]),
        }

    # ── 6. Platformun en çok satan 5 ilanı ───────────────────────────────────
    all_full_res = supabase.table("listings")\
        .select("id, title, category, price, sales_count, rating, clean_image_url")\
        .eq("status", "active")\
        .order("sales_count", desc=True)\
        .limit(5)\
        .execute()
    top_sector = all_full_res.data or []

    # ── 7. Yorum istatistikleri ───────────────────────────────────────────────
    listing_ids = [l["id"] for l in my_listings]
    review_stats    = {}
    low_rated       = []

    if listing_ids:
        rev_res = supabase.table("reviews")\
            .select("listing_id, rating, comment, created_at")\
            .in_("listing_id", listing_ids)\
            .order("created_at", desc=True)\
            .execute()
        reviews_data = rev_res.data or []

        for r in reviews_data:
            lid = r["listing_id"]
            if lid not in review_stats:
                review_stats[lid] = {"count": 0, "total_rating": 0, "recent_comments": []}
            review_stats[lid]["count"]        += 1
            review_stats[lid]["total_rating"] += r["rating"]
            if len(review_stats[lid]["recent_comments"]) < 3 and r.get("comment"):
                review_stats[lid]["recent_comments"].append({
                    "rating":  r["rating"],
                    "comment": r["comment"][:200],
                    "date":    r["created_at"],
                })

        for lid, stats in review_stats.items():
            stats["avg_rating"] = round(stats["total_rating"] / stats["count"], 1)
            del stats["total_rating"]

        # Düşük puanlı ilanlar (ortalama < 3.5, en az 1 yorum)
        low_rated = sorted(
            [
                {
                    "id":               l["id"],
                    "title":            l["title"],
                    "rating":           l.get("rating"),
                    "review_count":     review_stats.get(l["id"], {}).get("count", 0),
                    "recent_comments":  review_stats.get(l["id"], {}).get("recent_comments", []),
                }
                for l in my_listings
                if l.get("rating") is not None
                   and float(l["rating"]) < 3.5
                   and review_stats.get(l["id"], {}).get("count", 0) > 0
            ],
            key=lambda x: x["rating"] or 5,
        )[:5]

    # ── 8. İade istatistikleri (listing bazında) ─────────────────────────────
    refund_stats = {}   # listing_id → {refund_count, total_count, refund_rate}
    if listing_ids:
        # Satıcının iade edilmiş siparişleri
        refund_res = supabase.table("orders")\
            .select("listing_id, quantity")\
            .eq("seller_id", str(user_id))\
            .eq("status", "refunded")\
            .execute()

        # Satıcının toplam sipariş sayısı (listing bazında)
        total_orders_res = supabase.table("orders")\
            .select("listing_id, quantity")\
            .eq("seller_id", str(user_id))\
            .execute()

        # listing başına toplam sipariş adedi
        total_per_listing = {}
        for o in (total_orders_res.data or []):
            lid = o["listing_id"]
            total_per_listing[lid] = total_per_listing.get(lid, 0) + 1

        # listing başına iade adedi
        refund_per_listing = {}
        for o in (refund_res.data or []):
            lid = o["listing_id"]
            refund_per_listing[lid] = refund_per_listing.get(lid, 0) + 1

        # Sadece iade olanları refund_stats'a 