from fastapi import APIRouter
from sqlalchemy import text

from ..db import engine
from ..settings import settings

router = APIRouter(tags=["health"])


@router.get("/api/health")
async def health() -> dict:
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return {"status": "ok", "env": settings.env, "llm_provider": settings.llm_provider}
