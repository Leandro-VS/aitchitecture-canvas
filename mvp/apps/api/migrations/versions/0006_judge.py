"""juiz único: judge_runs e judge_findings

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-15
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "judge_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "diagram_id",
            UUID(as_uuid=True),
            sa.ForeignKey("diagrams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("canvas_hash", sa.String(64), nullable=False),
        sa.Column("corpus_version", sa.String(64), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="queued"),
        sa.Column("cached", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("verdict", sa.String(16), nullable=True),
        sa.Column("strengths", JSONB, nullable=False, server_default="[]"),
        sa.Column("error", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_judge_runs_diagram_id", "judge_runs", ["diagram_id"])
    op.create_index("ix_judge_runs_canvas_hash", "judge_runs", ["canvas_hash"])

    op.create_table(
        "judge_findings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "run_id",
            UUID(as_uuid=True),
            sa.ForeignKey("judge_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("basis", sa.String(16), nullable=False),
        sa.Column("citation", JSONB, nullable=True),
        sa.Column("component_refs", JSONB, nullable=False, server_default="[]"),
        sa.Column("recommendation", sa.String(), nullable=False),
        sa.Column("feedback", sa.String(4), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_judge_findings_run_id", "judge_findings", ["run_id"])


def downgrade() -> None:
    op.drop_table("judge_findings")
    op.drop_table("judge_runs")
