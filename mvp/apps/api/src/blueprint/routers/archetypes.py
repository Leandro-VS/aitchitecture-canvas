from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..catalog import ARCHETYPE_ORDER, CATEGORY_ORDER
from ..db import get_session
from ..db.models import ArchetypeConfig

router = APIRouter(tags=["archetypes"])


class ArchetypeOut(BaseModel):
    archetype: str
    archetype_class: str
    label: str
    description: str
    category: str
    base_rps: int | None
    base_latency_ms: float
    params: dict


@router.get("/api/archetypes")
async def list_archetypes(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ArchetypeOut]:
    rows = list(await session.scalars(select(ArchetypeConfig)))
    category_rank = {category: index for index, category in enumerate(CATEGORY_ORDER)}
    rows.sort(
        key=lambda row: (
            category_rank.get(row.category, 999),
            ARCHETYPE_ORDER.get(row.archetype, 999),
            row.label,
        )
    )
    return [ArchetypeOut.model_validate(row, from_attributes=True) for row in rows]
