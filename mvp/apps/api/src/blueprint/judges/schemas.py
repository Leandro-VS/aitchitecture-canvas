"""Contrato de saída do Juiz (M7) — Pydantic é ao mesmo tempo a validação da
resposta do LLM (mock ou real) e o shape da API.

Regra D15 imposta NO SCHEMA, não só no prompt: finding fundamentado em guideline
exige citação (doc + seção); finding sem base declara basis="general" e não pode
inventar referência.
"""

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class Citation(BaseModel):
    doc_id: str
    section: str  # heading_path do chunk usado (ex.: "Regra")
    excerpt: str = Field(default="", max_length=200)


class Finding(BaseModel):
    severity: Literal["critical", "warning", "info"]
    # refs semânticas resolvidas contra o canvas depois do parse:
    # id do nó, nome do nó ou "archetype:<slug>" (fixtures usam a última forma)
    component_refs: list[str] = []
    basis: Literal["guideline", "general"]
    citation: Citation | None = None
    recommendation: str

    @model_validator(mode="after")
    def citation_rule(self) -> "Finding":
        if self.basis == "guideline" and self.citation is None:
            raise ValueError("finding com basis=guideline exige citation (D15)")
        if self.basis == "general" and self.citation is not None:
            raise ValueError("finding com basis=general não pode ter citation (D15)")
        return self


class JudgeResult(BaseModel):
    score: int = Field(ge=0, le=100)
    verdict: Literal["pass", "borderline", "fail"]
    strengths: list[str] = []
    findings: list[Finding] = []
