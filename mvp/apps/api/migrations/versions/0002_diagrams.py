"""diagrams: CRUD com intake e canvas_state

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-14
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "diagrams",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("intake", JSONB, nullable=False),
        sa.Column("canvas_state", JSONB, nullable=False, server_default="{}"),
        sa.Column("canvas_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="in_progress"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_diagrams_owner_id", "diagrams", ["owner_id"])
    op.create_index("ix_diagrams_canvas_hash", "diagrams", ["canvas_hash"])


def downgrade() -> None:
    op.drop_table("diagrams")
