"""Worker arq — jobs assíncronos (juiz, indexação do corpus, exports).

Fase 0: só o job de ping para validar a topologia api → redis → worker.
"""

from arq.connections import RedisSettings

from .settings import settings


async def ping(ctx: dict) -> str:
    return "pong"


class WorkerSettings:
    functions = [ping]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_jobs = 4
