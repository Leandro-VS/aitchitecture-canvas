from pgvector.sqlalchemy import Vector
from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ...settings import settings
from .base import Base, TimestampMixin


class CorpusRelease(Base, TimestampMixin):
    """Release do pacote de guidelines (contrato D9/§8.1). MVP: a release que
    ativa substitui a anterior (sem blue/green navegável)."""

    __tablename__ = "corpus_releases"

    version: Mapped[str] = mapped_column(String(64), primary_key=True)
    status: Mapped[str] = mapped_column(String(16), default="indexing")
    # indexing | active | failed | superseded
    error_report: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    document_count: Mapped[int] = mapped_column(default=0)
    chunk_count: Mapped[int] = mapped_column(default=0)
    embedding_model: Mapped[str] = mapped_column(String(64), default="mock")


class CorpusDocument(Base):
    __tablename__ = "corpus_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    corpus_version: Mapped[str] = mapped_column(String(64), index=True)
    doc_id: Mapped[str] = mapped_column(String(64), index=True)  # estável entre releases
    title: Mapped[str] = mapped_column(String(200))
    doc_type: Mapped[str] = mapped_column(String(32))
    domain: Mapped[str] = mapped_column(String(32), index=True)
    front_matter: Mapped[dict] = mapped_column(JSONB, default=dict)


class CorpusChunk(Base):
    __tablename__ = "corpus_chunks"

    id: Mapped[int] = mapped_column(primary_key=True)
    corpus_version: Mapped[str] = mapped_column(String(64), index=True)
    doc_id: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(200))
    doc_type: Mapped[str] = mapped_column(String(32))
    domain: Mapped[str] = mapped_column(String(32), index=True)
    heading_path: Mapped[str] = mapped_column(String(500))  # "Regra > Exceções" → citação
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(settings.embedding_dim))
    # busca lexical (FTS) é por índice de expressão criado na migration —
    # no modo mock ela é o caminho principal de retrieval (pseudo-embeddings)
