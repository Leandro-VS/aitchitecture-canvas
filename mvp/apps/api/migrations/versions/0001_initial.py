"""initial: extensão vector, users, archetypes_config

Revision ID: 0001
Revises:
Create Date: 2026-07-14
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # pgvector desde o dia 1 — corpus_chunks (Fase 3) só adiciona a tabela
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("name", sa.String(), nullable=False, server_default=""),
        sa.Column("role", sa.String(16), nullable=False, server_default="user"),
        sa.Column("settings", JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "archetypes_config",
        sa.Column("archetype", sa.String(64), primary_key=True),
        sa.Column("archetype_class", sa.String(32), nullable=False),
        sa.Column("label", sa.String(64), nullable=False),
        sa.Column("category", sa.String(32), nullable=False),
        sa.Column("base_rps", sa.Integer(), nullable=True),
        sa.Column("base_latency_ms", sa.Float(), nullable=False, server_default="0"),
        sa.Column("params", JSONB, nullable=False, server_default="{}"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_table("archetypes_config")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
