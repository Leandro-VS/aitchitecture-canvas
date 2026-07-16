"""Pré-ADR (M9): contexto da sessão → Jinja2 → Markdown + PNG no objeto store.

O rascunho das seções editáveis (contexto/decisão/consequências) vem do LLM
(fixture no MVP); o usuário revisa antes do render final. O render em si não
envolve IA — é rápido e roda síncrono na API.
"""

import base64
import datetime as dt
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Diagram, JudgeFinding, JudgeRun
from ..judges.serialize import load_last_simulation, serialize_canvas
from ..llm import make_llm_client
from ..llm.parse import parse_with_retry

_env = Environment(
    loader=FileSystemLoader(Path(__file__).parent / "templates"),
    autoescape=select_autoescape(default=False),  # saída é Markdown, não HTML
    trim_blocks=True,
    lstrip_blocks=True,
)


class AdrSections(BaseModel):
    context: str = ""
    decision: str = ""
    consequences: str = ""


async def _latest_judge(session: AsyncSession, diagram: Diagram) -> dict | None:
    run = await session.scalar(
        select(JudgeRun)
        .where(JudgeRun.diagram_id == diagram.id, JudgeRun.status == "done")
        .order_by(JudgeRun.created_at.desc())
        .limit(1)
    )
    if run is None:
        return None
    findings = (
        await session.scalars(select(JudgeFinding).where(JudgeFinding.run_id == run.id))
    ).all()
    return {
        "score": run.score,
        "verdict": run.verdict,
        "strengths": run.strengths,
        "findings": [
            {
                "severity": f.severity,
                "recommendation": f.recommendation,
                "citation": f.citation,
                "resolved": f.resolved_at is not None,
            }
            for f in findings
        ],
    }


async def build_adr_context(
    session: AsyncSession, diagram: Diagram, author: str, sections: AdrSections
) -> dict:
    serialized = serialize_canvas(
        diagram.canvas_state,
        diagram.intake or {},
        await load_last_simulation(session, diagram),
    )
    return {
        "title": diagram.title,
        "author": author,
        "generated_at": dt.date.today().isoformat(),
        "sections": sections.model_dump(),
        "intake": diagram.intake,
        "components": serialized["components"],
        "connections": serialized["connections"],
        "annotations": serialized["annotations"],
        "simulation": serialized["last_simulation"],
        "judge": await _latest_judge(session, diagram),
    }


def render_adr(context: dict) -> str:
    return _env.get_template("adr_default.md.j2").render(**context)


def decode_png_data_url(data_url: str) -> bytes:
    """Aceita 'data:image/png;base64,<...>' vindo do html-to-image no front."""
    prefix = "data:image/png;base64,"
    if not data_url.startswith(prefix):
        raise ValueError("esperado data URL PNG base64")
    return base64.b64decode(data_url.removeprefix(prefix))


DRAFT_PROMPT = """A partir da sessão de design fornecida (intake, componentes,
simulação e avaliação), escreva rascunhos objetivos em português para as seções
editáveis de um ADR: context (o problema e o cenário), decision (a arquitetura
escolhida e por quê) e consequences (trade-offs e próximos passos).
Responda APENAS com JSON no schema fornecido."""


async def draft_sections(session: AsyncSession, diagram: Diagram) -> AdrSections:
    serialized = serialize_canvas(
        diagram.canvas_state,
        diagram.intake or {},
        await load_last_simulation(session, diagram),
    )
    import json

    return await parse_with_retry(
        AdrSections,
        make_llm_client(),
        [
            {"role": "system", "content": DRAFT_PROMPT},
            {"role": "user", "content": json.dumps(serialized, ensure_ascii=False)},
        ],
        feature="adr_draft",
    )
