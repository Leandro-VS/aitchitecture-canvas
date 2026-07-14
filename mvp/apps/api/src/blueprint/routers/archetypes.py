from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..db.models import ArchetypeConfig

router = APIRouter(tags=["archetypes"])


class ArchetypeOut(BaseModel):
    archetype: str
    archetype_class: str
    label: str
    category: str
    base_rps: int | None
    base_latency_ms: float
    params: dict


@router.get("/api/archetypes")
async def list_archetypes(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ArchetypeOut]:
    rows = await session.scalars(
        select(ArchetypeConfig).order_by(ArchetypeConfig.category, ArchetypeConfig.label)
    )
    return [ArchetypeOut.model_validate(r, from_attributes=True) for r in rows]
