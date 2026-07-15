import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser
from ..db import get_session
from ..db.models import ArchetypeConfig, Diagram, SimulationRun
from ..simulation import SimParams, SimResult, simulate
from ..simulation.engine import ArchetypeSpec
from .diagrams import CanvasState

router = APIRouter(tags=["simulation"])


class SimRequest(BaseModel):
    diagram_id: uuid.UUID
    params: SimParams = SimParams()
    # estado atual do editor: pode estar à frente do autosave (debounce 5s) —
    # simular o que está na tela, não o que já foi persistido
    canvas_state: CanvasState | None = None


async def load_archetype_specs(session: AsyncSession) -> dict[str, ArchetypeSpec]:
    rows = await session.scalars(select(ArchetypeConfig))
    return {
        r.archetype: ArchetypeSpec(
            archetype=r.archetype,
            archetype_class=r.archetype_class,
            base_rps=r.base_rps,
            base_latency_ms=r.base_latency_ms,
            params=r.params,
        )
        for r in rows
    }


@router.post("/api/simulation/run")
async def run_simulation(
    body: SimRequest,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SimResult:
    diagram = await session.get(Diagram, body.diagram_id)
    if diagram is None or diagram.owner_id != user.id:
        raise HTTPException(status_code=404, detail="diagrama não encontrado")

    archetypes = await load_archetype_specs(session)
    canvas = body.canvas_state.model_dump() if body.canvas_state else diagram.canvas_state
    result = simulate(canvas, body.params, archetypes)
    session.add(
        SimulationRun(
            diagram_id=diagram.id,
            params=body.params.model_dump(),
            metrics=result.model_dump(),
        )
    )
    await session.commit()
    return result
