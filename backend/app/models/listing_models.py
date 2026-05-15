"""
Listing Pydantic Modelleri — Request / Response şemaları
"""

from pydantic import BaseModel
from typing import Optional


# ── /listings/analyze response ──────────────────────────────────────────────
class AnalyzeResponse(BaseModel):
    listing_id:      str
    clean_image_url: str
    # Kategori artık Gemini tarafından belirleniyor


# ── /listings/generate request ──────────────────────────────────────────────
class GenerateRequest(BaseModel):
    listing_id:      str
    clean_image_url: str
    tone:            str            # professional | friendly | youth
    brand:           Optional[str] = ""
    price:           Optional[str] = ""
    extra_note:      Optional[str] = ""
    # category kaldırıldı — Gemini görselden otomatik tespit eder


# ── /listings/generate response ─────────────────────────────────────────────
class GenerateResponse(BaseModel):
    title:      str
    short_desc: str
    long_desc:  str
    features:   str
    seo_tags:   str
    category:   str     # Gemini'nin görselden tespit ettiği kategori


# ── /listings POST (ilan kaydet) request ────────────────────────────────────
class CreateListingRequest(BaseModel):
    listing_id:      str
    title:           str
    short_desc:      str
    long_desc:       str
    features:        str
    seo_tags:        str
    category:        str
    brand:           Optional[str] = ""
    price:           float
    cost_price:      Optional[float] = 0.0
    cargo_price:     Optional[float] = 29.90   # >0 müşteri öder | <0 satıcı öder | 0 ücretsiz
    stock:           int
    variant:         Optional[str] = ""
    shipping_day:    Optional[str] = ""
    clean_image_url: str


# ── /listings GET response (liste için) ─────────────────────────────────────
class ListingItem(BaseModel):
    id:              str
    title:           str
    category:        str
    price:           float
    stock:           int
    status:          str
    clean_image_url: Optional[str]
    created_at:      str
