"""Enfileiramento de jobs no worker (arq sobre Redis)."""

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from .settings import settings

_pool: ArqRedis | None = None


async def get_queue() -> ArqRedis:
    global _pool
    if _pool is None:
        _pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    return _pool
