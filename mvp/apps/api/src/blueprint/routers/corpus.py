import datetime as dt
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser
from ..corpus.search import SearchHit, search_guidelines
from ..db import get_session
from ..db.models import CorpusDocument, CorpusRelease
from ..queue import get_queue

router = APIRouter(tags=["corpus"])


def require_admin(user: CurrentUser) -> None:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="requer papel admin")


class PublishRequest(BaseModel):
    version: str = Field(min_length=1, max_length=64)


class ReleaseOut(BaseModel):
    version: str
    status: str
    error_report: dict | None
    document_count: int
    chunk_count: int
    embedding_model: str
    updated_at: dt.datetime


class DocumentOut(BaseModel):
    doc_id: str
    title: str
    doc_type: str
    domain: str
    front_matter: dict


@router.post("/api/corpus/publish", status_code=202)
async def publish_release(body: PublishRequest, user: CurrentUser) -> dict:
    """Dispara a indexação da release publicada em corpus/releases/<version>/
    no bucket. Assíncrono: acompanhe em GET /api/corpus/releases."""
    require_admin(user)
    queue = await get_queue()
    await queue.enqueue_job("index_corpus_release", body.version)
    return {"version": body.version, "status": "indexing"}


@router.get("/api/corpus/releases")
async def list_releases(
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ReleaseOut]:
    rows = await session.scalars(
        select(CorpusRelease).order_by(CorpusRelease.updated_at.desc())
    )
    return [ReleaseOut.model_validate(r, from_attributes=True) for r in rows]


@router.get("/api/corpus/documents")
async def list_documents(
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[DocumentOut]:
    active = await session.scalar(
        select(CorpusRelease.version).where(CorpusRelease.status == "active")
    )
    if active is None:
        return []
    rows = await session.scalars(
        select(CorpusDocument)
        .where(CorpusDocument.corpus_version == active)
        .order_by(CorpusDocument.doc_id)
    )
    return [DocumentOut.model_validate(d, from_attributes=True) for d in rows]


@router.get("/api/corpus/search")
async def search(
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
    q: Annotated[str, Query(min_length=2)],
    k: Annotated[int, Query(ge=1, le=20)] = 8,
    domain: Annotated[list[str] | None, Query()] = None,
) -> list[SearchHit]:
    """Endpoint de debug do retrieval (critério da Fase 3) — o mesmo
    search_guidelines que o Juiz e o Arquiteto usarão nas Fases 4–5."""
    return await search_guidelines(session, q, k=k, domains=domain)
