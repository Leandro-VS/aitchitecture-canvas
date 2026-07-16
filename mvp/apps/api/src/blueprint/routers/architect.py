import asyncio
import datetime as dt
import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from ..architect.bootstrap import generate_sketch, prefill_intake
from ..architect.diff import InvalidDiff, ProposedDiff, prepare_diff
from ..auth import CurrentUser
from ..corpus.search import search_guidelines
from ..db import get_session
from ..db.models import ArchitectMessage, Diagram
from ..judges.serialize import load_last_simulation, serialize_canvas
from ..llm import make_llm_client
from ..schemas.intake import Intake
from .diagrams import CanvasState, compute_canvas_hash, require_intake

router = APIRouter(tags=["architect"])

SYSTEM_PROMPT = """Você é o Arquiteto: um copiloto de design de arquitetura que
responde na mesma tela do canvas. Fundamenta recomendações nos guidelines
fornecidos e cita doc + seção quando aplicável (nunca invente referência).
Quando uma mudança estrutural ajudar, proponha um diff (add_node/connect/...)
usando apenas arquétipos do catálogo — o usuário decide aplicar ou não."""


class ChatRequest(BaseModel):
    diagram_id: uuid.UUID
    message: str = Field(min_length=1, max_length=4000)
    canvas_state: CanvasState | None = None  # contexto = o que está na tela


class MessageOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    proposed_diff: dict | None
    diff_status: str | None
    created_at: dt.datetime


async def _owned_diagram(
    session: AsyncSession, user_id: uuid.UUID, diagram_id: uuid.UUID
) -> Diagram:
    diagram = await session.get(Diagram, diagram_id)
    if diagram is None or diagram.owner_id != user_id:
        raise HTTPException(status_code=404, detail="diagrama não encontrado")
    return diagram


@router.post("/api/architect/chat")
async def chat(
    body: ChatRequest,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    diagram = await _owned_diagram(session, user.id, body.diagram_id)
    intake = require_intake(diagram)  # recurso de IA → 409 sem contexto

    if body.canvas_state is not None:
        diagram.canvas_state = body.canvas_state.model_dump()
        diagram.canvas_hash = compute_canvas_hash(diagram.canvas_state, diagram.intake)
    session.add(ArchitectMessage(diagram_id=diagram.id, role="user", content=body.message))

    # todo o trabalho de IA/DB acontece ANTES do stream começar — o generator
    # só entrega (a session da dependency fecha quando a resposta termina)
    serialized = serialize_canvas(
        diagram.canvas_state, intake.model_dump(), await load_last_simulation(session, diagram)
    )
    chunks = await search_guidelines(session, body.message, k=6)
    guideline_text = "\n\n".join(f"[{h.citation}]\n{h.excerpt}" for h in chunks)
    raw = await make_llm_client().chat(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"GUIDELINES:\n{guideline_text}\n\n"
                f"DIAGRAMA:\n{json.dumps(serialized, ensure_ascii=False)}\n\n"
                f"PERGUNTA: {body.message}",
            },
        ],
        feature="architect",
    )
    content = str(raw.get("content", ""))

    validated: ProposedDiff | None = None
    if raw.get("proposed_diff"):
        try:
            validated = prepare_diff(raw["proposed_diff"], diagram.canvas_state)
            if not validated.ops:
                validated = None  # nada aplicável a este canvas
        except (InvalidDiff, ValueError):
            validated = None  # diff inválido nunca chega ao usuário

    assistant = ArchitectMessage(
        diagram_id=diagram.id,
        role="assistant",
        content=content,
        proposed_diff=validated.model_dump() if validated else None,
        diff_status="proposed" if validated else None,
    )
    session.add(assistant)
    await session.commit()
    message_id = str(assistant.id)
    diff_payload = validated.model_dump() if validated else None

    async def stream():
        for word in content.split(" "):
            yield {"event": "token", "data": word + " "}
            await asyncio.sleep(0.012)  # cadência de streaming (mock é instantâneo)
        if diff_payload:
            yield {
                "event": "proposed_diff",
                "data": json.dumps({"message_id": message_id, **diff_payload}),
            }
        yield {"event": "done", "data": json.dumps({"message_id": message_id})}

    return EventSourceResponse(stream())


@router.get("/api/architect/messages")
async def list_messages(
    diagram_id: uuid.UUID,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[MessageOut]:
    await _owned_diagram(session, user.id, diagram_id)
    rows = await session.scalars(
        select(ArchitectMessage)
        .where(ArchitectMessage.diagram_id == diagram_id)
        .order_by(ArchitectMessage.created_at)
    )
    return [MessageOut.model_validate(m, from_attributes=True) for m in rows]


async def _set_diff_status(
    session: AsyncSession, user_id: uuid.UUID, message_id: uuid.UUID, status: str
) -> MessageOut:
    message = await session.get(ArchitectMessage, message_id)
    if message is None or message.proposed_diff is None:
        raise HTTPException(status_code=404, detail="diff não encontrado")
    await _owned_diagram(session, user_id, message.diagram_id)
    message.diff_status = status
    await session.commit()
    return MessageOut.model_validate(message, from_attributes=True)


@router.post("/api/architect/diffs/{message_id}/apply")
async def apply_diff(
    message_id: uuid.UUID,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> MessageOut:
    """O front materializa os ghost nodes e autosalva; aqui registra o aceite (H3)."""
    return await _set_diff_status(session, user.id, message_id, "applied")


@router.post("/api/architect/diffs/{message_id}/dismiss")
async def dismiss_diff(
    message_id: uuid.UUID,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> MessageOut:
    return await _set_diff_status(session, user.id, message_id, "dismissed")


# --- bootstrap (M13) ---


class PrefillRequest(BaseModel):
    text: str = Field(min_length=20, max_length=8000)


@router.post("/api/architect/bootstrap/prefill")
async def bootstrap_prefill(body: PrefillRequest, user: CurrentUser) -> Intake:
    """Descrição livre → intake pré-preenchido (inferred_fields marca o que a IA
    inferiu). O front NUNCA pula a revisão humana (US1)."""
    return await prefill_intake(body.text)


class SketchRequest(BaseModel):
    diagram_id: uuid.UUID


@router.post("/api/architect/bootstrap/sketch")
async def bootstrap_sketch(
    body: SketchRequest,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProposedDiff:
    """Intake validado → esboço (ProposedDiff sobre canvas vazio). Auto-layout
    no front (dagre); falha do LLM → 502 e o front cai no canvas vazio."""
    diagram = await _owned_diagram(session, user.id, body.diagram_id)
    intake = require_intake(diagram)
    chunks = await search_guidelines(session, intake.summary, k=6)
    try:
        diff = await generate_sketch(intake, chunks)
    except (InvalidDiff, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"esboço inválido: {exc}") from exc

    # a conversa de bootstrap vira o 1º turno do chat (continuidade de contexto)
    session.add(ArchitectMessage(
        diagram_id=diagram.id, role="user",
        content=f"[bootstrap] Gerar esboço inicial: {intake.summary}",
    ))
    session.add(ArchitectMessage(
        diagram_id=diagram.id, role="assistant", content=diff.rationale,
        proposed_diff=diff.model_dump(), diff_status="applied",
    ))
    await session.commit()
    return diff
