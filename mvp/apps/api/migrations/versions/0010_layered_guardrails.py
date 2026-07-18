"""split input and output guardrails

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-17
"""

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE archetypes_config
        SET archetype_class = 'input-guardrail',
            label = 'Input Guardrail',
            description = (
                'Inspeciona a entrada antes do modelo para bloquear ataques, abuso e ' ||
                'conteúdo inadequado, evitando chamadas desnecessárias ao LLM.'
            ),
            base_rps = 1200,
            base_latency_ms = 20,
            params = jsonb_build_object(
                'simulation_profile', 'input_guardrail',
                'default_guardrail_scope', 'current_turn',
                'default_guardrail_failure_mode', 'fail_closed'
            )
        WHERE archetype = 'guardrails'
        """
    )
    op.execute(
        """
        INSERT INTO archetypes_config
            (archetype, archetype_class, label, description, category, base_rps,
             base_latency_ms, params, version)
        VALUES
            ('output-guardrail', 'output-guardrail', 'Output Guardrail',
             ('Avalia a resposta do modelo junto da pergunta original antes de ' ||
              'entregá-la ao usuário.'),
             'AI & Agents', 900, 60,
             jsonb_build_object(
                 'simulation_profile', 'output_guardrail',
                 'default_guardrail_scope', 'current_turn',
                 'default_guardrail_failure_mode', 'fail_closed'
             ),
             1)
        ON CONFLICT (archetype) DO UPDATE SET
            archetype_class = EXCLUDED.archetype_class,
            label = EXCLUDED.label,
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            base_rps = EXCLUDED.base_rps,
            base_latency_ms = EXCLUDED.base_latency_ms,
            params = EXCLUDED.params
        """
    )
    op.execute(
        """
        UPDATE archetypes_config
        SET params = params || '{"simulation_profile":"observation_sink"}'::jsonb
        WHERE archetype = 'llm-observability'
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM archetypes_config WHERE archetype = 'output-guardrail'")
    op.execute(
        """
        UPDATE archetypes_config
        SET archetype_class = 'guardrail',
            label = 'Guardrails',
            description = (
                'Valida entradas e saídas de IA segundo regras de segurança e ' ||
                'conformidade.'
            ),
            base_rps = 900,
            base_latency_ms = 60,
            params = '{}'::jsonb
        WHERE archetype = 'guardrails'
        """
    )
    op.execute(
        """
        UPDATE archetypes_config
        SET params = params - 'simulation_profile'
        WHERE archetype = 'llm-observability'
        """
    )
