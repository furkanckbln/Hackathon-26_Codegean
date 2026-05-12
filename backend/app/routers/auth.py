from fastapi import APIRouter, Depends, HTTPException, Header
from app.database.supabase_client import supabase

router = APIRouter()

# ── Dependency: JWT doğrulama ─────────────────────────────────────────────────
async def get_current_user(authorization: str = Header(...)):
    """
    Her korumalı endpoint'e Depends(get_current_user) olarak eklenir.
    Frontend'den gelen Authorization: Bearer <token> header'ını doğrular.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Geçersiz token formatı.")
    token = authorization.replace("Bearer ", "")
    try:
        response = supabase.auth.get_user(token)
        return response.user
    except Exception:
        raise HTTPException(status_code=401, detail="Token geçersiz veya süresi dolmuş.")


# ── /auth/me → Giriş yapan kullanıcı bilgisi (test endpoint'i) ───────────────
@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
    return {
        "id":    current_user.id,
        "email": current_user.email,
        "store_name": current_user.user_metadata.get("store_name"),
    }
