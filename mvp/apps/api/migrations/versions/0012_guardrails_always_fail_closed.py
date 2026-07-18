"""make guardrails always fail closed

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-17
"""

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE archetypes_config
        SET params = params - 'default_guardrail_failure_mode'
        WHERE archetype IN ('guardrails', 'output-guardrail')
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE archetypes_config
        SET params = params || '{"default_guardrail_failure_mode":"fail_closed"}'::jsonb
        WHERE archetype IN ('guardrails', 'output-guardrail')
        """
    )
