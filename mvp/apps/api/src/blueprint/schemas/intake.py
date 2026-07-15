"""Intake obrigatório do diagrama (D12/M11) — contexto permanente de toda chamada de IA.

Validações de "mínimo de conteúdo" (não só preenchido) vêm da US1: campos rasos
não passam, nem no fluxo com bootstrap por IA.
"""

from typing import Literal

from pydantic import BaseModel, Field


class NFR(BaseModel):
    base_rps: int = Field(gt=0, description="RPS estimado na entrada do sistema")
    p99_ms: int = Field(gt=0, description="latência p99 alvo em ms")
    availability_pct: float = Field(ge=90, le=100, description="disponibilidade alvo (%)")
    read_ratio: float = Field(ge=0, le=1, description="fração de leituras (0–1)")
    data_classification: Literal["publica", "interna", "confidencial", "restrita"]


class Intake(BaseModel):
    summary: str = Field(min_length=40)
    functional_requirements: list[str] = Field(min_length=1)
    considerations: str = Field(min_length=20)
    nfr: NFR
    out_of_scope: str | None = None
    # bootstrap (M13, Fase 5) marca aqui o que a IA preencheu → front exibe "inferido — revisar"
    inferred_fields: list[str] = []
