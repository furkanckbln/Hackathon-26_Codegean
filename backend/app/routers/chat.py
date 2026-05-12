"""
Chat Router — İlan Düzenleme Asistanı

POST /chat/listing  → Satıcının prompt'una göre ilan içeriğini düzenler
"""

import asyncio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.routers.auth import get_current_user
from app.services.gemini_service import chat_edit_listing

router = APIRouter()


class ChatRequest(BaseModel):
    message:      str
    current_form: dict          # {title, shortDesc, longDesc, features, seoTags}
    category:     str
    tone:         str           # professional | friendly | youth
    listing_id:   Optional[str] = None


class ChatResponse(BaseModel):
    updated_form: dict          # değişen alanlar (camelCase, frontend ile uyumlu)
    reply:        str           # kullanıcıya gösterilecek mesaj


@router.post("/listing", response_model=ChatResponse)
async def chat_listing(
    body: ChatRequest,
    current_user=Depends(get_current_user),
):
    """
    Satıcının doğal dil isteğini alır, Gemini ile ilan içeriğini günceller.
    Sadece değişen alanlar döner — frontend mevcut state'i korur.
    """
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Mesaj boş olamaz.")

    try:
        result = await asyncio.to_thread(
            chat_edit_listing,
            body.message,
            body.current_form,
            body.category,
            body.tone,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat hatası: {str(e)}")

    # gemini_service snake_case döndürüyor, frontend camelCase bekliyor
    snake_to_camel = {
        "title":      "title",
        "short_desc": "shortDesc",
        "long_desc":  "longDesc",
        "features":   "features",
        "seo_tags":   "seoTags",
    }

    updated_camel = {
        snake_to_camel[k]: v
        for k, v in result["updated_form"].items()
        if k in snake_to_camel
    }

    return ChatResponse(
        updated_form=updated_camel,
        reply=result["reply"],
    )
