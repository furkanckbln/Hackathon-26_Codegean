from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
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


async def require_seller(current_user=Depends(get_current_user)):
    """
    Sadece satıcı hesaplarına izin verir.
    user_type metadata'dan okunur; eksikse 'seller' varsayılır (geriye dönük uyumluluk).
    """
    user_type = (current_user.user_metadata or {}).get("user_type", "seller")
    if user_type != "seller":
        raise HTTPException(status_code=403, detail="Bu işlem yalnızca satıcı hesapları için geçerlidir.")
    return current_user


# ── /auth/me → Giriş yapan kullanıcı bilgisi (test endpoint'i) ───────────────
@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
    return {
        "id":    current_user.id,
        "email": current_user.email,
        "store_name": current_user.user_metadata.get("store_name"),
    }


# ── /auth/balance → Bakiye sorgula / yükle ───────────────────────────────────
@router.get("/balance")
async def get_balance(current_user=Depends(get_current_user)):
    result = (
        supabase.from_("users")
        .select("balance")
        .eq("id", str(current_user.id))
        .single()
        .execute()
    )
    return {"balance": result.data.get("balance", 0)}


class BalanceTopUpRequest(BaseModel):
    amount: int   # tam sayı TL


@router.post("/balance")
async def top_up_balance(body: BalanceTopUpRequest, current_user=Depends(get_current_user)):
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Miktar pozitif bir tam sayı olmalı.")

    # add_balance RPC: bakiyeyi atomik olarak artırır
    supabase.rpc(
        "add_balance",
        {"p_user_id": str(current_user.id), "p_amount": body.amount},
    ).execute()

    # Güncel bakiyeyi döndür
    result = (
        supabase.from_("users")
        .select("balance")
        .eq("id", str(current_user.id))
        .single()
        .execute()
    )
    return {"balance": result.data.get("balance", 0)}
