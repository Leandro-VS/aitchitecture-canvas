import datetime as dt
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import objstore
from ..auth import CurrentUser
from ..db import get_session
from ..db.models import Diagram, Export
from ..exports.adr import (
    AdrSections,
    build_adr_context,
    decode_png_data_url,
    draft_sections,
    render_adr,
)
from ..exports.mermaid import render_mermaid
from .diagrams import require_intake

router = APIRouter(tags=["exports"])


async def _owned_diagram(
    session: AsyncSession, user_id: uuid.UUID, diagram_id: uuid.UUID
) -> Diagram:
    diagram = await session.get(Diagram, diagram_id)
    if diagram is None or diagram.owner_id != user_id:
        raise HTTPException(status_code=404, detail="diagrama não encontrado")
    return diagram


class DraftRequest(BaseModel):
    diagram_id: uuid.UUID
    canvas_state: dict | None = None


@router.post("/api/exports/draft")
async def export_draft(
    body: DraftRequest,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AdrSections:
    """Rascunho IA das seções editáveis (contexto/decisão/consequências)."""
    diagram = await _owned_diagram(session, user.id, body.diagram_id)
    require_intake(diagram)  # rascunho é recurso de IA
    return await draft_sections(session, diagram, body.canvas_state)


class PreviewRequest(BaseModel):
    diagram_id: uuid.UUID
    sections: AdrSections = Field(default_factory=AdrSections)
    canvas_state: dict | None = None


class PreviewOut(BaseModel):
    markdown: str
    mermaid: str


@router.post("/api/exports/preview")
async def preview_export(
    body: PreviewRequest,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PreviewOut:
    """Renderiza a versão final sem criar registro nem gravar no object store."""
    diagram = await _owned_diagram(session, user.id, body.diagram_id)
    context = await build_adr_context(
        session,
        diagram,
        user.name or user.email,
        body.sections,
        body.canvas_state,
    )
    return PreviewOut(
        markdown=render_adr(context),
        mermaid=render_mermaid(body.canvas_state or diagram.canvas_state),
    )


class ExportRequest(BaseModel):
    diagram_id: uuid.UUID
    sections: AdrSections = Field(default_factory=AdrSections)
    canvas_state: dict | None = None
    # PNG do canvas capturado pelo front (html-to-image); opcional
    png_data_url: str | None = Field(default=None, max_length=8_000_000)


class ExportOut(BaseModel):
    id: uuid.UUID
    format: str
    md_url: str
    png_url: str | None
    mermaid_url: str
    created_at: dt.datetime


@router.post("/api/exports", status_code=201)
async def create_export(
    body: ExportRequest,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ExportOut:
    """Render Jinja2 → MD, Mermaid (+PNG) no MinIO/S3 com URL assinada. Sem IA aqui —
    exportar funciona mesmo sem intake (seções ficam 'a preencher')."""
    diagram = await _owned_diagram(session, user.id, body.diagram_id)
    context = await build_adr_context(
        session,
        diagram,
        user.name or user.email,
        body.sections,
        body.canvas_state,
    )
    md = render_adr(context)
    mermaid = render_mermaid(body.canvas_state or diagram.canvas_state)

    slug = dt.datetime.now(dt.UTC).strftime("%Y%m%d-%H%M%S")
    base_key = f"exports/{diagram.id}/{slug}"
    md_key = f"{base_key}/pre-adr.md"
    mermaid_key = f"{base_key}/diagram.mmd"
    await objstore.put_object(md_key, md.encode("utf-8"), "text/markdown; charset=utf-8")
    await objstore.put_object(
        mermaid_key,
        mermaid.encode("utf-8"),
        "text/plain; charset=utf-8",
    )

    png_url = None
    if body.png_data_url:
        try:
            png = decode_png_data_url(body.png_data_url)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        await objstore.put_object(f"{base_key}/pre-adr.png", png, "image/png")
        png_url = await objstore.presign(f"{base_key}/pre-adr.png")

    export = Export(diagram_id=diagram.id, format="md", s3_key=md_key)
    session.add(export)
    await session.commit()
    await session.refresh(export)
    return ExportOut(
        id=export.id,
        format="md",
        md_url=await objstore.presign(md_key),
        png_url=png_url,
        mermaid_url=await objstore.presign(mermaid_key),
        created_at=export.created_at,
    )


@router.get("/api/exports")
async def list_exports(
    diagram_id: uuid.UUID,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ExportOut]:
    await _owned_diagram(session, user.id, diagram_id)
    rows = (
        await session.scalars(
            select(Export).where(Export.diagram_id == diagram_id).order_by(Export.created_at.desc())
        )
    ).all()
    return [
        ExportOut(
            id=e.id,
            format=e.format,
            md_url=await objstore.presign(e.s3_key),
            png_url=await objstore.presign(e.s3_key.replace("pre-adr.md", "pre-adr.png")),
            mermaid_url=await objstore.presign(e.s3_key.replace("pre-adr.md", "diagram.mmd")),
            created_at=e.created_at,
        )
        for e in rows
    ]
