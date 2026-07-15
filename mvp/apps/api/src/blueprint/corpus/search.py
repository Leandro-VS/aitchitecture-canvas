"""Busca no corpus ativo com citação verificável (doc_id > heading_path).

Modo mock: pseudo-embeddings não carregam semântica, então o caminho principal
é o FTS do Postgres (config 'portuguese'); a busca vetorial complementa quando
o FTS não preenche k. Com provider real, a vetorial assume o papel principal —
mesma interface, mesmos dados.
"""

from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import CorpusChunk, CorpusRelease
from ..llm import make_llm_client

EXCERPT_CHARS = 400


class SearchHit(BaseModel):
    doc_id: str
    title: str
    doc_type: str
    domain: str
    heading_path: str
    citation: str  # "SEC-012 > Regra" — formato exibido/citado pelas IAs (D15)
    excerpt: str
    score: float


def _to_hit(chunk: CorpusChunk, score: float) -> SearchHit:
    citation = chunk.doc_id + (f" > {chunk.heading_path}" if chunk.heading_path else "")
    return SearchHit(
        doc_id=chunk.doc_id,
        title=chunk.title,
        doc_type=chunk.doc_type,
        domain=chunk.domain,
        heading_path=chunk.heading_path,
        citation=citation,
        excerpt=chunk.content[:EXCERPT_CHARS],
        score=round(score, 4),
    )


async def get_active_version(session: AsyncSession) -> str | None:
    return await session.scalar(
        select(CorpusRelease.version).where(CorpusRelease.status == "active")
    )


async def search_guidelines(
    session: AsyncSession,
    query: str,
    *,
    k: int = 8,
    domains: list[str] | None = None,
) -> list[SearchHit]:
    active = await get_active_version(session)
    if active is None:
        return []

    domain_sql = "AND domain = ANY(:domains)" if domains else ""
    fts = await session.execute(
        text(
            f"""
            SELECT id, ts_rank_cd(to_tsvector('portuguese', content),
                                  websearch_to_tsquery('portuguese', :q)) AS rank
            FROM corpus_chunks
            WHERE corpus_version = :version {domain_sql}
              AND to_tsvector('portuguese', content) @@ websearch_to_tsquery('portuguese', :q)
            ORDER BY rank DESC
            LIMIT :k
            """
        ),
        {"q": query, "version": active, "k": k, **({"domains": domains} if domains else {})},
    )
    ranked = list(fts.all())
    ids = [row.id for row in ranked]
    chunks = {
        c.id: c
        for c in await session.scalars(select(CorpusChunk).where(CorpusChunk.id.in_(ids)))
    } if ids else {}
    hits = [_to_hit(chunks[row.id], float(row.rank)) for row in ranked if row.id in chunks]

    if len(hits) < k:  # complemento vetorial (determinístico também no mock)
        qvec = (await make_llm_client().embed([query], feature="rag_query"))[0]
        stmt = (
            select(CorpusChunk)
            .where(CorpusChunk.corpus_version == active, CorpusChunk.id.notin_(ids))
            .order_by(CorpusChunk.embedding.cosine_distance(qvec))
            .limit(k - len(hits))
        )
        if domains:
            stmt = stmt.where(CorpusChunk.domain.in_(domains))
        for chunk in await session.scalars(stmt):
            hits.append(_to_hit(chunk, 0.0))
    return hits
