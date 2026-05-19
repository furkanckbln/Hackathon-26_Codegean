import asyncio
import sys
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, listings, finance, chat, assistant, orders, reviews
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="SellerAI API")

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://hackathon-26-codegean.vercel.app",
    "https://hackathon-26-codegean-9iggkggd1-furkanckblns-projects.vercel.app",
]

# Railway env'den gelen FRONTEND_URL de listeye ekle (boşsa atla)
_extra = os.getenv("FRONTEND_URL", "")
if _extra and _extra not in origins:
    origins.append(_extra)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,     prefix="/auth",     tags=["auth"])
app.include_router(listings.router, prefix="/listings", tags=["listings"])
app.include_router(finance.router,  prefix=