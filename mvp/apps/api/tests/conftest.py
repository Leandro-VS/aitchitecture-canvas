"""Fixtures de teste de API: banco blueprint_test isolado no Postgres do compose.

Os testes de rota precisam da stack local de pé (make up); sem Postgres
acessível eles são pulados — os testes unitários continuam rodando.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from blueprint.db import get_session
from blueprint.db.models import Base
from blueprint.main import app

PG = "postgresql+asyncpg://blueprint:blueprint@localhost:5432"
TEST_DB_URL = f"{PG}/blueprint_test"


async def _ensure_test_db() -> None:
    admin = create_async_engine(f"{PG}/postgres", isolation_level="AUTOCOMMIT")
    try:
        async with admin.connect() as conn:
            exists = await conn.scalar(
                text("SELECT 1 FROM pg_database WHERE datname = 'blueprint_test'")
            )
            if not exists:
                await conn.execute(text("CREATE DATABASE blueprint_test"))
    except OSError:
        pytest.skip("Postgres indisponível — suba a stack (make up) para os testes de API")
    finally:
        await admin.dispose()


_state: dict = {}


@pytest.fixture
async def client():
    await _ensure_test_db()
    engine = create_async_engine(TEST_DB_URL)
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False)
    _state["maker"] = maker

    async def override_session():
        async with maker() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.fixture
async def indexed_corpus(client):
    """Indexa o corpus-example direto no banco de teste (sem S3)."""
    import json
    from pathlib import Path

    from blueprint.corpus.parser import validate_release
    from blueprint.db.models import CorpusChunk, CorpusDocument, CorpusRelease
    from blueprint.llm.mock import pseudo_embedding

    corpus_dir = Path(__file__).parents[3] / "corpus-example"
    manifest = json.loads((corpus_dir / "manifest.json").read_text())
    files = {f"docs/{p.name}": p.read_bytes() for p in (corpus_dir / "docs").glob("*.md")}
    version = manifest["corpus_version"]
    docs = validate_release(version, manifest, files)

    async with _state["maker"]() as session:
        session.add(CorpusRelease(version=version, status="active"))
        for doc in docs:
            session.add(CorpusDocument(
                corpus_version=version, doc_id=doc.doc_id, title=doc.title,
                doc_type=doc.doc_type, domain=doc.domain, front_matter=doc.front_matter,
            ))
            for chunk in doc.chunks:
                session.add(CorpusChunk(
                    corpus_version=version, doc_id=doc.doc_id, title=doc.title,
                    doc_type=doc.doc_type, domain=doc.domain,
                    heading_path=chunk.heading_path, content=chunk.content,
                    embedding=pseudo_embedding(chunk.content, 1024),
                ))
        await session.commit()
    return version


@pytest.fixture
async def seed_archetypes(client):
    """Popula archetypes_config no banco de teste (necessário p/ simulação via API)."""
    from blueprint.catalog import CATALOG
    from blueprint.db.models import ArchetypeConfig

    async with _state["maker"]() as session:
        for item in CATALOG:
            session.add(ArchetypeConfig(**item))
        await session.commit()
