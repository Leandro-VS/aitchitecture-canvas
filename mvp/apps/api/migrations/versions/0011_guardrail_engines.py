"""add guardrail engine defaults

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-17
"""

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE archetypes_config
        SET params = params || '{"default_guardrail_engine":"deterministic"}'::jsonb
        WHERE archetype = 'guardrails'
        """
    )
    op.execute(
        """
        UPDATE archetypes_config
        SET params = params || '{"default_guardrail_engine":"generative"}'::jsonb
        WHERE archetype = 'output-guardrail'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE archetypes_config
        SET params = params - 'default_guardrail_engine'
        WHERE archetype IN ('guardrails', 'output-guardrail')
        """
    )
