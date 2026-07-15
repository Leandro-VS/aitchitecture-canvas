"""Worker arq — jobs assíncronos (indexação do corpus; juiz e exports nas
próximas fases)."""

from arq.connections import RedisSettings

from .corpus.ingest import index_release
from .settings import settings


async def ping(ctx: dict) -> str:
    return "pong"


async def index_corpus_release(ctx: dict, version: str) -> None:
    await index_release(version)


class WorkerSettings:
    functions = [ping, index_corpus_release]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_jobs = 4
