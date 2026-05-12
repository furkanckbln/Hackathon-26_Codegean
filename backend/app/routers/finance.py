from fastapi import APIRouter, Depends
from app.routers.auth import get_current_user

router = APIRouter()

@router.get("/")
async def placeholder(current_user=Depends(get_current_user)):
    return {"message": "finance router çalışıyor", "user": current_user.email}
