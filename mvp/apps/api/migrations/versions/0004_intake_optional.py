"""intake opcional na criação (obrigatório só para recursos de IA)

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-15
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("diagrams", "intake", nullable=True)


def downgrade() -> None:
    op.execute("UPDATE diagrams SET intake = '{}'::jsonb WHERE intake IS NULL")
    op.alter_column("diagrams", "intake", nullable=False, existing_type=sa.dialects.postgresql.JSONB)
