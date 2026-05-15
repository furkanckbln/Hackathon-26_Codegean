import asyncio
import sys
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, listings, finance, chat, assistant, orders
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="SellerAI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,     prefix="/auth",     tags=["auth"])
app.include_router(listings.router, prefix="/listings", tags=["listings"])
app.include_router(finance.router,  prefix="/finance",  tags=["finance"])
app.include_router(chat.router,      prefix="/chat",      tags=["chat"])
app.include_router(assistant.router, prefix="/assistant", tags=["assistant"])
app.include_router(orders.router,    prefix="/orders",    tags=["orders"])

@app.get("/")
def root():
    return {"status": "SellerAI API çalışıyor"}
