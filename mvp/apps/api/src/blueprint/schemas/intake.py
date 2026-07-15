"""Intake do diagrama (D12/M11) — contexto qualitativo das chamadas de IA.

Opcional na criação (desenhar/simular não exige); obrigatório e completo para
usar recursos de IA (gate em require_intake). Os NFRs quantitativos (RPS, p99
alvo etc.) NÃO vivem aqui: são parâmetros do painel de simulação (SimParams).
"""

from typing import Literal

from pydantic import BaseModel, Field


class Intake(BaseModel):
    summary: str = Field(min_length=40)
    functional_requirements: list[str] = Field(min_length=1)
    considerations: str = Field(min_length=20)
    data_classification: Literal["publica", "interna", "confidencial", "restrita"] = "interna"
    out_of_scope: str | None = None
    # bootstrap (M13, Fase 5) marca aqui o que a IA preencheu → front exibe "inferido — revisar"
    inferred_fields: list[str] = []
