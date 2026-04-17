from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.routers import auth, heroes, builds, items, tierlists, patchnotes, history, admin, coaching
from app.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(title="Deadlock Meta API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(heroes.router, prefix="/api/heroes", tags=["heroes"])
app.include_router(builds.router, prefix="/api/builds", tags=["builds"])
app.include_router(items.router, prefix="/api/items", tags=["items"])
app.include_router(tierlists.router, prefix="/api/tierlists", tags=["tierlists"])
app.include_router(patchnotes.router, prefix="/api/patchnotes", tags=["patchnotes"])
app.include_router(history.router, prefix="/api/history", tags=["history"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(coaching.router, prefix="/api/coaching", tags=["coaching"])

@app.get("/api/health")
async def health():
    return {"status": "ok"}