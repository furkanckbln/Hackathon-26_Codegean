"""
Listings Router

Endpoint'ler:
  POST /listings/analyze  — Görsel yükle → rembg çalıştır → temiz PNG üret
  POST /listings/generate — Temiz görsel + kategori → Gemini → ilan metni üret
  POST /listings          — İlanı Supabase'e kaydet
  GET  /listings          — Satıcının ilanlarını listele
  GET  /listings/all      — Tüm aktif ilanlar (rakip analizi)
  PATCH /listings/{id}    — İlan durumu güncelle (aktif/pasif/taslak)
  DELETE /listings/{id}   — İlan sil
"""

import uuid
import asyncio
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException

from app.routers.auth import get_current_user
from app.services.rembg_service import remove_background
from app.services.gemini_service import generate_listing_content
from app.database.supabase_client import supabase
from app.models.listing_models import (
    AnalyzeResponse,
    GenerateRequest,
    GenerateResponse,
    CreateListingRequest,
)

router = APIRouter()


# ── POST /listings/analyze ───────────────────────────────────────────────────
@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_image(
    image: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    """
    1. Görseli al
    2. YOLO ile arka planı temizle, kategoriyi tespit et
    3. Temiz PNG'yi Supabase Storage'a yükle
    4. URL + kategori döndür
    """
    # Dosya tipi kontrolü
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Sadece görsel dosyası yüklenebilir.")

    image_bytes = await image.read()

    # rembg ile arka plan temizle
    try:
        clean_png = await asyncio.to_thread(remove_background, image_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Arka plan temizleme hatası: {str(e)}")

    # Supabase Storage'a yükle
    listing_id   = str(uuid.uuid4())
    storage_path = f"{current_user.id}/{listing_id}/clean.png"

    try:
        supabase.storage.from_("product-images").upload(
            path=storage_path,
            file=clean_png,
            file_options={"content-type": "image/png"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Görsel yükleme hatası: {str(e)}")

    clean_image_url = supabase.storage.from_("product-images").get_public_url(storage_path)

    return AnalyzeResponse(
        listing_id=listing_id,
        clean_image_url=clean_image_url,
    )


# ── POST /listings/generate ──────────────────────────────────────────────────
@router.post("/generate", response_model=GenerateResponse)
async def generate_listing(
    body: GenerateRequest,
    current_user=Depends(get_current_user),
):
    """
    Gemini Vision ile ilan metni üret.
    TODO: gemini_service.py entegrasyonu yapılacak.
    """
    try:
        content = await asyncio.to_thread(
            generate_listing_content,
            image_url  = body.clean_image_url,
            tone       = body.tone,
            brand      = body.brand or "",
            price      = body.price or "",
            extra_note = body.extra_note or "",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini içerik üretimi başarısız: {str(e)}")

    return GenerateResponse(**content)


# ── POST /listings ────────────────────────────────────────────────────────────
@router.post("/")
async def create_listing(
    body: CreateListingRequest,
    current_user=Depends(get_current_user),
):
    """İlanı Supabase veritabanına kaydet."""
    try:
        result = supabase.table("listings").insert({
            "id":              body.listing_id,
            "user_id":         current_user.id,
            "title":           body.title,
            "short_desc":      body.short_desc,
            "long_desc":       body.long_desc,
            "features":        body.features.split("\n"),   # liste olarak sakla
            "seo_tags":        [t.strip() for t in body.seo_tags.split(",")],
            "category":        body.category,
            "price":           body.price,
            "cost_price":      body.cost_price or 0.0,
            "cargo_price":     body.cargo_price if body.cargo_price is not None else 29.90,
            "tax_rate":        body.tax_rate  if body.tax_rate  is not None else 20.0,
            "tax_amount":      round(body.price * ((body.tax_rate or 20.0) / 100), 2),
            "stock":           body.stock,
            "status":          "active",
            "clean_image_url": body.clean_image_url,
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"İlan kaydedilemedi: {str(e)}")

    return {"message": "İlan başarıyla yayınlandı.", "listing_id": body.listing_id}


# ── GET /listings ─────────────────────────────────────────────────────────────
@router.get("/")
async def get_my_listings(current_user=Depends(get_current_user)):
    """Giriş yapan satıcının ilanlarını döndür."""
    result = supabase.table("listings")\
        .select("id, title, category, price, stock, status, clean_image_url, created_at")\
        .eq("user_id", current_user.id)\
        .order("created_at", desc=True)\
        .execute()
    return result.data

# ── GET /listings/public/{listing_id} ─────────────────────────────────────────
@router.get("/public/{listing_id}")
async def get_public_listing(listing_id: str):
    """
    Müşteri vitrini için tek bir ilanın detaylarını döndürür.
    Auth gerektirmez. Satıcıya özel finansal verileri (cost_price vb.) KORUR.
    """
    result = supabase.table("listings")\
        .select("id, title, short_desc, long_desc, features, seo_tags, category, price, cargo_price, stock, sales_count, rating, clean_image_url, created_at, status")\
        .eq("id", listing_id)\
        .eq("status", "active")\
        .single()\
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="İlan bulunamadı veya aktif değil.")

    return result.data


# ── GET /listings/all ─────────────────────────────────────────────────────────
@router.get("/all")
async def get_all_listings(
    category: str = None,
):
    """
    Tüm satıcıların aktif ilanlarını döndür.
    Rakip analizi + müşteri vitrini için — auth gerektirmez (public data).
    """
    query = supabase.table("listings")\
        .select("id, title, category, price, cargo_price, stock, clean_image_url, sales_count, rating, created_at")\
        .eq("status", "active")

    if category:
        query = query.eq("category", category)

    result = query.order("created_at", desc=True).execute()
    return result.data


# ── GET /listings/{listing_id} ───────────────────────────────────────────────
@router.get("/{listing_id}")
async def get_listing(
    listing_id: str,
    current_user=Depends(get_current_user),
):
    """Tek bir ilanın tüm detaylarını döndür."""
    result = supabase.table("listings")\
        .select("*")\
        .eq("id", listing_id)\
        .single()\
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="İlan bulunamadı.")

    return result.data


# ── PUT /listings/{listing_id} — Tüm alanları güncelle ──────────────────────
@router.put("/{listing_id}")
async def update_listing(
    listing_id: str,
    body: dict,
    current_user=Depends(get_current_user),
):
    """İlan içeriğini (başlık, açıklama, fiyat vb.) güncelle."""
    allowed = {"title", "short_desc", "long_desc", "features", "seo_tags",
               "category", "price", "cost_price", "cargo_price",
               "tax_rate", "tax_amount", "stock", "status"}
    update_data = {k: v for k, v in body.items() if k in allowed}

    # features ve seo_tags liste olarak saklanıyor
    if "features" in update_data and isinstance(update_data["features"], str):
        update_data["features"] = [f.strip() for f in update_data["features"].split("\n") if f.strip()]
    if "seo_tags" in update_data and isinstance(update_data["seo_tags"], str):
        update_data["seo_tags"] = [t.strip() for t in update_data["seo_tags"].split(",") if t.strip()]

    if not update_data:
        raise HTTPException(status_code=400, detail="Güncellenecek alan bulunamadı.")

    supabase.table("listings")\
        .update(update_data)\
        .eq("id", listing_id)\
        .eq("user_id", current_user.id)\
        .execute()

    return {"message": "İlan güncellendi."}


# ── PATCH /listings/{listing_id} ─────────────────────────────────────────────
@router.patch("/{listing_id}")
async def update_listing_status(
    listing_id: str,
    status: str,
    current_user=Depends(get_current_user),
):
    """İlan durumunu güncelle: active | passive | draft"""
    if status not in ("active", "passive", "draft"):
        raise HTTPException(status_code=400, detail="Geçersiz durum. active / passive / draft olmalı.")

    supabase.table("listings")\
        .update({"status": status})\
        .eq("id", listing_id)\
        .eq("user_id", current_user.id)\
        .execute()

    return {"message": f"İlan durumu '{status}' olarak güncellendi."}


# ── DELETE /listings/{listing_id} ────────────────────────────────────────────
@router.delete("/{listing_id}")
async def delete_listing(
    listing_id: str,
    current_user=Depends(get_current_user),
):
    """İlanı sil. Supabase Storage'daki görseli de sil."""
    # DB'den sil
    supabase.table("listings")\
        .delete()\
        .eq("id", listing_id)\
        .eq("user_id", current_user.id)\
        .execute()

    # Storage'dan görseli sil
    storage_path = f"{current_user.id}/{listing_id}/clean.png"
    try:
        supabase.storage.from_("product-images").remove([storage_path])
    except Exception:
        pass  # Görsel yoksa sessizce geç

    return {"message": "İlan silindi."}
