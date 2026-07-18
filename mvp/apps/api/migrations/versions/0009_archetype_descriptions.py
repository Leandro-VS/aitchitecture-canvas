"""add descriptions to archetype catalog

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-17
"""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "archetypes_config",
        sa.Column(
            "description",
            sa.String(320),
            nullable=False,
            server_default="Descrição do componente indisponível.",
        ),
    )


def downgrade() -> None:
    op.drop_column("archetypes_config", "description")
