"""Indexação de uma release do corpus: S3/MinIO → validação → chunks → banco.

Roda como job do worker (arq). A release só fica ativa se TODOS os documentos
passarem; falha vira status=failed com relatório consultável.
"""

import json

from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from .. import objstore
from ..db import SessionMaker
from ..db.models import CorpusChunk, CorpusDocument, CorpusRelease
from ..llm import make_llm_client
from ..settings import settings
from .parser import ParsedDoc, ReleaseRejected, validate_release

RELEASE_PREFIX = "corpus/releases"
EMBED_BATCH = 64


async def fetch_release_files(version: str) -> tuple[dict, dict[str, bytes]]:
    prefix = f"{RELEASE_PREFIX}/{version}/"
    manifest = json.loads(await objstore.get_object(f"{prefix}manifest.json"))
    files: dict[str, bytes] = {}
    for entry in manifest.get("documents", []):
        path = entry.get("path")
        if not path:
            continue
        try:
            files[path] = await objstore.get_object(f"{prefix}{path}")
        except Exception:  # noqa: BLE001 — ausência vira erro de validação
            pass
    return manifest, files


async def _persist_docs(
    session: AsyncSession, version: str, docs: list[ParsedDoc]
) -> tuple[int, int]:
    llm = make_llm_client()
    # reindexação da mesma versão substitui o conteúdo dela
    await session.execute(delete(CorpusChunk).where(CorpusChunk.corpus_version == version))
    await session.execute(delete(CorpusDocument).where(CorpusDocument.corpus_version == version))

    chunk_rows: list[CorpusChunk] = []
    for doc in docs:
        session.add(
            CorpusDocument(
                corpus_version=version,
                doc_id=doc.doc_id,
                title=doc.title,
                doc_type=doc.doc_type,
                domain=doc.domain,
                front_matter=doc.front_matter,
            )
        )
        for chunk in doc.chunks:
            chunk_rows.append(
                CorpusChunk(
                    corpus_version=version,
                    doc_id=doc.doc_id,
                    title=doc.title,
                    doc_type=doc.doc_type,
                    domain=doc.domain,
                    heading_path=chunk.heading_path,
                    content=chunk.content,
                    embedding=[],  # preenchido em lote abaixo
                )
            )

    for start in range(0, len(chunk_rows), EMBED_BATCH):
        batch = chunk_rows[start : start + EMBED_BATCH]
        vectors = await llm.embed([c.content for c in batch], feature="ingest")
        for row, vec in zip(batch, vectors, strict=True):
            row.embedding = vec
        session.add_all(batch)

    return len(docs), len(chunk_rows)


async def index_release(version: str) -> None:
    async with SessionMaker() as session:
        release = await session.get(CorpusRelease, version)
        if release is None:
            release = CorpusRelease(version=version)
            session.add(release)
        release.status = "indexing"
        release.error_report = None
        release.embedding_model = settings.llm_provider
        await session.commit()

        try:
            manifest, files = await fetch_release_files(version)
            docs = validate_release(version, manifest, files)
            doc_count, chunk_count = await _persist_docs(session, version, docs)
        except ReleaseRejected as exc:
            release.status = "failed"
            release.error_report = {"errors": exc.errors}
            await session.commit()
            return
        except Exception as exc:  # infra (bucket fora, chave ausente…)
            release.status = "failed"
            release.error_report = {"errors": [f"falha de infraestrutura: {exc}"]}
            await session.commit()
            return

        # swap: a nova ativa substitui a anterior (MVP: sem rollback navegável)
        await session.execute(
            update(CorpusRelease)
            .where(CorpusRelease.status == "active", CorpusRelease.version != version)
            .values(status="superseded")
        )
        release.status = "active"
        release.document_count = doc_count
        release.chunk_count = chunk_count
        await session.commit()
