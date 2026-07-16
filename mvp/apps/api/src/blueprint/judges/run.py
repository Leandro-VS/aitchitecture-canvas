"""Execução do Juiz único (M7): rubrica combinada + RAG + saída validada.

`execute_judge_run` é o núcleo testável (recebe session/redis); o job do worker
e o cache em volta ficam finos. Cache por (canvas_hash, corpus_version): re-rodar
sem mudanças é instantâneo e gratuito (US5).
"""

import datetime as dt
import json

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from ..corpus.search import search_guidelines
from ..db.models import Diagram, JudgeFinding, JudgeRun
from ..llm import make_llm_client
from ..llm.parse import parse_with_retry
from .schemas import JudgeResult
from .serialize import load_last_simulation, resolve_component_refs, serialize_canvas

CACHE_TTL_S = 7 * 24 * 3600

RUBRIC = """Você é um comitê de arquitetura avaliando um diagrama de sistema.
Avalie o diagrama nas três dimensões, fundamentado nos trechos de guidelines fornecidos:
1. Confiabilidade e escala: gargalos, pontos únicos de falha, capacidade vs. NFRs,
   uso de cache/filas, réplicas.
2. Segurança e governança: classificação de dados, exposição externa, guardrails.
3. Arquitetura GenAI: uso de gateway de LLM, cache semântico, guardrails de
   entrada/saída, custo e latência de inferência.

Regras de citação (obrigatórias): todo finding apoiado em guideline deve citar
doc_id + seção reais dos trechos fornecidos (basis="guideline"); se nenhum
guideline se aplica, basis="general" e nenhuma citação. Nunca invente referência.
Responda APENAS com JSON no schema fornecido."""


def cache_key(canvas_hash: str, corpus_version: str | None) -> str:
    return f"judge:{canvas_hash}:{corpus_version or 'sem-corpus'}"


def build_messages(serialized: dict, chunks: list) -> list[dict]:
    guidelines = "\n\n".join(
        f"[{hit.citation}]\n{hit.excerpt}" for hit in chunks
    ) or "(nenhum guideline disponível)"
    return [
        {"role": "system", "content": RUBRIC},
        {
            "role": "user",
            "content": "GUIDELINES RELEVANTES:\n"
            f"{guidelines}\n\n"
            "DIAGRAMA (serialização canônica):\n"
            f"{json.dumps(serialized, ensure_ascii=False, indent=1)}",
        },
    ]


def retrieval_query(serialized: dict) -> str:
    archetypes = " ".join(c["archetype"] for c in serialized["components"])
    return f"{serialized['intake'].get('summary', '')} {archetypes}"


async def persist_result(
    session: AsyncSession, run: JudgeRun, result: JudgeResult, canvas: dict
) -> None:
    run.score = result.score
    run.verdict = result.verdict
    run.strengths = result.strengths
    run.status = "done"
    for f in result.findings:
        session.add(
            JudgeFinding(
                run_id=run.id,
                severity=f.severity,
                basis=f.basis,
                citation=f.citation.model_dump() if f.citation else None,
                component_refs=resolve_component_refs(f.component_refs, canvas),
                recommendation=f.recommendation,
            )
        )


async def execute_judge_run(
    session: AsyncSession, run: JudgeRun, *, redis: Redis | None = None
) -> None:
    run.status = "running"
    await session.commit()

    diagram = await session.get(Diagram, run.diagram_id)
    assert diagram is not None and diagram.intake is not None  # gate no router
    canvas = diagram.canvas_state
    serialized = serialize_canvas(
        canvas, diagram.intake, await load_last_simulation(session, diagram)
    )
    chunks = await search_guidelines(session, retrieval_query(serialized), k=8)
    result = await parse_with_retry(
        JudgeResult, make_llm_client(), build_messages(serialized, chunks), feature="judge"
    )
    await persist_result(session, run, result, canvas)
    await session.commit()

    if redis is not None:
        payload = result.model_dump()
        for f, resolved in zip(
            payload["findings"],
            [resolve_component_refs(f.component_refs, canvas) for f in result.findings],
            strict=True,
        ):
            f["component_refs"] = resolved
        await redis.set(
            cache_key(run.canvas_hash, run.corpus_version),
            json.dumps(payload),
            ex=CACHE_TTL_S,
        )


async def restore_cached_run(
    session: AsyncSession, run: JudgeRun, cached_payload: dict
) -> None:
    """Materializa um run 'done' a partir do cache (findings novos → feedback
    independente por execução)."""
    result = JudgeResult.model_validate(cached_payload)
    run.status = "done"
    run.cached = True
    run.score = result.score
    run.verdict = result.verdict
    run.strengths = result.strengths
    for f, raw in zip(result.findings, cached_payload["findings"], strict=True):
        session.add(
            JudgeFinding(
                run_id=run.id,
                severity=f.severity,
                basis=f.basis,
                citation=f.citation.model_dump() if f.citation else None,
                component_refs=raw.get("component_refs", []),
                recommendation=f.recommendation,
            )
        )


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.UTC).replace(tzinfo=None)
