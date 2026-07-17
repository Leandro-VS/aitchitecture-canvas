import datetime as dt
import hashlib
import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser
from ..db import get_session
from ..db.models import Diagram
from ..schemas.intake import Intake, IntakeDraft

router = APIRouter(tags=["diagrams"])

EMPTY_CANVAS: dict = {"nodes": [], "edges": [], "viewport": None}


class CanvasState(BaseModel):
    """Validação leve na Fase 1 — o shape dos nós aperta na Fase 2 (metadados)."""

    nodes: list[dict] = []
    edges: list[dict] = []
    viewport: dict | None = None
    simulation_params: dict | None = None


class CreateDiagram(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    # opcional: desenhar aceita rascunho parcial; recursos de IA exigem o
    # contrato completo por meio de require_intake.
    intake: IntakeDraft | None = None


class UpdateDiagram(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    intake: IntakeDraft | None = None
    canvas_state: CanvasState | None = None


class DiagramSummary(BaseModel):
    id: uuid.UUID
    title: str
    status: str
    node_count: int
    has_intake: bool
    updated_at: dt.datetime


class DiagramOut(BaseModel):
    id: uuid.UUID
    title: str
    intake: IntakeDraft | None
    canvas_state: dict
    canvas_hash: str
    status: str
    created_at: dt.datetime
    updated_at: dt.datetime


def require_intake(diagram: Diagram) -> Intake:
    """Gate dos recursos de IA (juiz, arquiteto, bootstrap): intake completo.

    Desenhar/simular funciona sem contexto; toda chamada de IA passa por aqui.
    """
    if diagram.intake is None:
        raise HTTPException(
            status_code=409,
            detail="preencha o contexto (intake) do diagrama para usar recursos de IA",
        )
    try:
        return Intake.model_validate(diagram.intake)
    except ValidationError as exc:
        missing = sorted({str(error["loc"][0]) for error in exc.errors() if error["loc"]})
        fields = ", ".join(missing) or "campos obrigatórios"
        raise HTTPException(
            status_code=409,
            detail=f"complete o contexto para usar recursos de IA: {fields}",
        ) from exc


def compute_canvas_hash(canvas_state: dict, intake: dict | None) -> str:
    payload = json.dumps(
        {"canvas": canvas_state, "intake": intake},
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


async def get_owned_diagram(
    diagram_id: uuid.UUID,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Diagram:
    diagram = await session.get(Diagram, diagram_id)
    if diagram is None or diagram.owner_id != user.id:
        # 404 também para não-dono: não revela existência (M1: cada um vê só os seus)
        raise HTTPException(status_code=404, detail="diagrama não encontrado")
    return diagram


OwnedDiagram = Annotated[Diagram, Depends(get_owned_diagram)]


@router.post("/api/diagrams", status_code=201)
async def create_diagram(
    body: CreateDiagram,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> DiagramOut:
    intake = body.intake.model_dump() if body.intake else None
    diagram = Diagram(
        owner_id=user.id,
        title=body.title,
        intake=intake,
        canvas_state=EMPTY_CANVAS,
        canvas_hash=compute_canvas_hash(EMPTY_CANVAS, intake),
    )
    session.add(diagram)
    await session.commit()
    await session.refresh(diagram)
    return DiagramOut.model_validate(diagram, from_attributes=True)


@router.get("/api/diagrams")
async def list_diagrams(
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[DiagramSummary]:
    rows = await session.scalars(
        select(Diagram).where(Diagram.owner_id == user.id).order_by(Diagram.updated_at.desc())
    )
    return [
        DiagramSummary(
            id=d.id,
            title=d.title,
            status=d.status,
            node_count=len(d.canvas_state.get("nodes", [])),
            has_intake=d.intake is not None,
            updated_at=d.updated_at,
        )
        for d in rows
    ]


@router.get("/api/diagrams/{diagram_id}")
async def get_diagram(diagram: OwnedDiagram) -> DiagramOut:
    return DiagramOut.model_validate(diagram, from_attributes=True)


@router.patch("/api/diagrams/{diagram_id}")
async def update_diagram(
    body: UpdateDiagram,
    diagram: OwnedDiagram,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> DiagramOut:
    if body.title is not None:
        diagram.title = body.title
    if body.intake is not None:
        diagram.intake = body.intake.model_dump()
    if body.canvas_state is not None:
        diagram.canvas_state = body.canvas_state.model_dump()
    diagram.canvas_hash = compute_canvas_hash(diagram.canvas_state, diagram.intake)
    await session.commit()
    await session.refresh(diagram)
    return DiagramOut.model_validate(diagram, from_attributes=True)


@router.delete("/api/diagrams/{diagram_id}", status_code=204)
async def delete_diagram(
    diagram: OwnedDiagram,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    await session.delete(diagram)
    await session.commit()
