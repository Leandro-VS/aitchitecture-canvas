import datetime as dt
import json
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser
from ..corpus.search import get_active_version
from ..db import get_session
from ..db.models import Diagram, JudgeFinding, JudgeRun
from ..judges.run import cache_key, restore_cached_run, utcnow
from ..queue import get_queue
from ..settings import settings
from .diagrams import CanvasState, compute_canvas_hash, require_intake

router = APIRouter(tags=["judges"])


class JudgeRunRequest(BaseModel):
    diagram_id: uuid.UUID
    # estado atual do editor — persiste como autosave antes de julgar
    canvas_state: CanvasState | None = None


class FindingOut(BaseModel):
    id: uuid.UUID
    severity: str
    basis: str
    citation: dict | None
    component_refs: list
    recommendation: str
    feedback: str | None
    resolved_at: dt.datetime | None


class JudgeRunOut(BaseModel):
    id: uuid.UUID
    status: str
    cached: bool
    score: int | None
    verdict: str | None
    strengths: list
    findings: list[FindingOut]
    error: str | None
    created_at: dt.datetime


async def _expire_if_stale(session: AsyncSession, run: JudgeRun) -> None:
    """Run órfão (worker caiu/job perdido) não pode prender o polling para
    sempre: além do timeout, vira failed e o usuário pode re-rodar."""
    if run.status in ("queued", "running"):
        age = (utcnow() - run.created_at).total_seconds()
        if age > settings.judge_timeout_s:
            run.status = "failed"
            run.error = f"avaliação não concluiu em {settings.judge_timeout_s}s — rode novamente"
            await session.commit()


async def _run_out(session: AsyncSession, run: JudgeRun) -> JudgeRunOut:
    await _expire_if_stale(session, run)
    findings = (
        await session.scalars(
            select(JudgeFinding)
            .where(JudgeFinding.run_id == run.id)
            .order_by(JudgeFinding.severity, JudgeFinding.id)
        )
    ).all()
    return JudgeRunOut(
        id=run.id,
        status=run.status,
        cached=run.cached,
        score=run.score,
        verdict=run.verdict,
        strengths=run.strengths,
        findings=[FindingOut.model_validate(f, from_attributes=True) for f in findings],
        error=run.error,
        created_at=run.created_at,
    )


async def _owned_diagram(
    session: AsyncSession, user_id: uuid.UUID, diagram_id: uuid.UUID
) -> Diagram:
    diagram = await session.get(Diagram, diagram_id)
    if diagram is None or diagram.owner_id != user_id:
        raise HTTPException(status_code=404, detail="diagrama não encontrado")
    return diagram


@router.post("/api/judges/run", status_code=202)
async def start_judge_run(
    body: JudgeRunRequest,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> JudgeRunOut:
    diagram = await _owned_diagram(session, user.id, body.diagram_id)
    require_intake(diagram)  # recurso de IA: contexto obrigatório (409)

    if body.canvas_state is not None:  # julga o que está na tela
        diagram.canvas_state = body.canvas_state.model_dump()
    canvas_hash = compute_canvas_hash(diagram.canvas_state, diagram.intake)
    diagram.canvas_hash = canvas_hash
    corpus_version = await get_active_version(session)

    run = JudgeRun(
        diagram_id=diagram.id, canvas_hash=canvas_hash, corpus_version=corpus_version
    )
    session.add(run)
    await session.flush()  # atribui run.id (default uuid4 só dispara no flush)

    queue = await get_queue()
    cached = await queue.get(cache_key(canvas_hash, corpus_version))
    if cached:
        await restore_cached_run(session, run, json.loads(cached))
        await session.commit()
        return await _run_out(session, run)

    await session.commit()
    await queue.enqueue_job("judge_run", str(run.id))
    return await _run_out(session, run)


@router.get("/api/judges/runs/{run_id}")
async def get_judge_run(
    run_id: uuid.UUID,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> JudgeRunOut:
    run = await session.get(JudgeRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="run não encontrado")
    await _owned_diagram(session, user.id, run.diagram_id)
    return await _run_out(session, run)


@router.get("/api/judges/latest")
async def latest_judge_run(
    diagram_id: uuid.UUID,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> JudgeRunOut | None:
    await _owned_diagram(session, user.id, diagram_id)
    run = await session.scalar(
        select(JudgeRun)
        .where(JudgeRun.diagram_id == diagram_id)
        .order_by(JudgeRun.created_at.desc())
        .limit(1)
    )
    return await _run_out(session, run) if run else None


class FindingPatch(BaseModel):
    feedback: Literal["up", "down"] | None = None
    clear_feedback: bool = False
    resolved: bool | None = None


@router.patch("/api/findings/{finding_id}")
async def patch_finding(
    finding_id: uuid.UUID,
    body: FindingPatch,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FindingOut:
    finding = await session.get(JudgeFinding, finding_id)
    if finding is None:
        raise HTTPException(status_code=404, detail="finding não encontrado")
    run = await session.get(JudgeRun, finding.run_id)
    await _owned_diagram(session, user.id, run.diagram_id)

    if body.clear_feedback:
        finding.feedback = None
    elif body.feedback is not None:
        finding.feedback = body.feedback
    if body.resolved is not None:
        finding.resolved_at = utcnow() if body.resolved else None
    await session.commit()
    return FindingOut.model_validate(finding, from_attributes=True)
