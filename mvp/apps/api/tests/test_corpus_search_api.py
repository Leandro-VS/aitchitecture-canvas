"""Busca do corpus via API: FTS acha o chunk certo e cita doc > seção (Fase 3)."""

import json
from pathlib import Path

import pytest
from conftest import _state

from blueprint.corpus.parser import validate_release
from blueprint.db.models import CorpusChunk, CorpusDocument, CorpusRelease
from blueprint.llm.mock import pseudo_embedding

CORPUS_DIR = Path(__file__).parents[3] / "corpus-example"


@pytest.fixture
async def indexed_corpus(client):
    """Indexa o corpus-example direto no banco de teste (sem S3)."""
    manifest = json.loads((CORPUS_DIR / "manifest.json").read_text())
    files = {f"docs/{p.name}": p.read_bytes() for p in (CORPUS_DIR / "docs").glob("*.md")}
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


async def test_search_cites_doc_and_section(client, indexed_corpus):
    res = await client.get("/api/corpus/search", params={"q": "guardrail de saída"})
    assert res.status_code == 200, res.text
    hits = res.json()
    assert hits, "busca não retornou nada"
    top = hits[0]
    assert top["doc_id"] == "SEC-012"
    assert top["citation"].startswith("SEC-012 > ")
    assert top["heading_path"] in {"Regra", "Racional", "Exceções"}


async def test_search_domain_filter(client, indexed_corpus):
    res = await client.get(
        "/api/corpus/search", params={"q": "gateway", "domain": ["security"]}
    )
    assert res.status_code == 200
    assert all(h["domain"] == "security" for h in res.json())


async def test_search_without_active_release_is_empty(client):
    res = await client.get("/api/corpus/search", params={"q": "guardrail"})
    assert res.status_code == 200
    assert res.json() == []


async def test_documents_lists_active_release(client, indexed_corpus):
    res = await client.get("/api/corpus/documents")
    assert {d["doc_id"] for d in res.json()} == {"SEC-012", "GENAI-001", "REF-ARCH-RAG-01"}
