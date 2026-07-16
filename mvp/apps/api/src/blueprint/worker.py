"""Worker arq — jobs assíncronos (indexação do corpus, juiz; exports na Fase 6)."""

import uuid

from arq.connections import RedisSettings

from .corpus.ingest import index_release
from .db import SessionMaker
from .db.models import JudgeRun
from .judges.run import execute_judge_run
from .settings import settings


async def ping(ctx: dict) -> str:
    return "pong"


async def index_corpus_release(ctx: dict, version: str) -> None:
    await index_release(version)


async def judge_run(ctx: dict, run_id: str) -> None:
    async with SessionMaker() as session:
        run = await session.get(JudgeRun, uuid.UUID(run_id))
        if run is None:
            return
        try:
            await execute_judge_run(session, run, redis=ctx["redis"])
        except Exception as exc:  # noqa: BLE001 — run nunca fica preso em running
            await session.rollback()
            run = await session.get(JudgeRun, uuid.UUID(run_id))
            run.status = "failed"
            run.error = str(exc)[:500]
            await session.commit()
            raise


class WorkerSettings:
    functions = [ping, index_corpus_release, judge_run]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_jobs = 4
