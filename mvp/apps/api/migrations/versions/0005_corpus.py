"""corpus: releases, documentos e chunks (pgvector HNSW + FTS por expressão)

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-15
"""

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import JSONB

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

EMBEDDING_DIM = 1024


def upgrade() -> None:
    op.create_table(
        "corpus_releases",
        sa.Column("version", sa.String(64), primary_key=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="indexing"),
        sa.Column("error_report", JSONB, nullable=True),
        sa.Column("document_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("chunk_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("embedding_model", sa.String(64), nullable=False, server_default="mock"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "corpus_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("corpus_version", sa.String(64), nullable=False),
        sa.Column("doc_id", sa.String(64), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("doc_type", sa.String(32), nullable=False),
        sa.Column("domain", sa.String(32), nullable=False),
        sa.Column("front_matter", JSONB, nullable=False, server_default="{}"),
    )
    op.create_index("ix_corpus_documents_corpus_version", "corpus_documents", ["corpus_version"])
    op.create_index("ix_corpus_documents_doc_id", "corpus_documents", ["doc_id"])
    op.create_index("ix_corpus_documents_domain", "corpus_documents", ["domain"])

    op.create_table(
        "corpus_chunks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("corpus_version", sa.String(64), nullable=False),
        sa.Column("doc_id", sa.String(64), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("doc_type", sa.String(32), nullable=False),
        sa.Column("domain", sa.String(32), nullable=False),
        sa.Column("heading_path", sa.String(500), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(EMBEDDING_DIM), nullable=False),
    )
    op.create_index("ix_corpus_chunks_corpus_version", "corpus_chunks", ["corpus_version"])
    op.create_index("ix_corpus_chunks_doc_id", "corpus_chunks", ["doc_id"])
    op.create_index("ix_corpus_chunks_domain", "corpus_chunks", ["domain"])
    # vetorial (provider real futuro) + lexical (caminho principal no modo mock)
    op.execute(
        "CREATE INDEX ix_corpus_chunks_embedding ON corpus_chunks "
        "USING hnsw (embedding vector_cosine_ops)"
    )
    op.execute(
        "CREATE INDEX ix_corpus_chunks_fts ON corpus_chunks "
        "USING gin (to_tsvector('portuguese', content))"
    )


def downgrade() -> None:
    op.drop_table("corpus_chunks")
    op.drop_table("corpus_documents")
    op.drop_table("corpus_releases")
