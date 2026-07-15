"""simulation_runs: histórico de simulações

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-15
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "simulation_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "diagram_id",
            UUID(as_uuid=True),
            sa.ForeignKey("diagrams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("params", JSONB, nullable=False),
        sa.Column("metrics", JSONB, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_simulation_runs_diagram_id", "simulation_runs", ["diagram_id"])


def downgrade() -> None:
    op.drop_table("simulation_runs")
