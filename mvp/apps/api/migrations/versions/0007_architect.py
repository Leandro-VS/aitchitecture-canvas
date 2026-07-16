"""arquiteto: architect_messages (chat + diffs propostos)

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-15
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "architect_messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "diagram_id",
            UUID(as_uuid=True),
            sa.ForeignKey("diagrams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("proposed_diff", JSONB, nullable=True),
        sa.Column("diff_status", sa.String(16), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_architect_messages_diagram_id", "architect_messages", ["diagram_id"])


def downgrade() -> None:
    op.drop_table("architect_messages")
