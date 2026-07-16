"""exports: histórico de pré-ADRs exportados

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-16
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "exports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "diagram_id",
            UUID(as_uuid=True),
            sa.ForeignKey("diagrams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("format", sa.String(8), nullable=False, server_default="md"),
        sa.Column("s3_key", sa.String(300), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_exports_diagram_id", "exports", ["diagram_id"])


def downgrade() -> None:
    op.drop_table("exports")
