"""Seed idempotente: catálogo de arquétipos + usuário dev.

Uso: python -m blueprint.seed  (make seed roda migrations antes)
"""

import asyncio

from sqlalchemy.dialects.postgresql import insert

from .catalog import CATALOG
from .db import SessionMaker
from .db.models import ArchetypeConfig, User
from .settings import settings


async def seed() -> None:
    async with SessionMaker() as session:
        for item in CATALOG:
            stmt = insert(ArchetypeConfig).values(**item)
            stmt = stmt.on_conflict_do_update(
                index_elements=[ArchetypeConfig.archetype],
                set_={k: v for k, v in item.items() if k != "archetype"},
            )
            await session.execute(stmt)

        stmt = insert(User).values(
            email=settings.dev_email, name="Dev", role="admin"
        ).on_conflict_do_nothing(index_elements=[User.email])
        await session.execute(stmt)

        await session.commit()
    print(f"seed ok: {len(CATALOG)} arquétipos + usuário {settings.dev_email}")


if __name__ == "__main__":
    asyncio.run(seed())
