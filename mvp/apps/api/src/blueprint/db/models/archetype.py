from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class ArchetypeConfig(Base):
    """Tabela base do simulador (§6.1 das specs) + metadados de palette.

    base_rps nulo = capacidade infinita (client).
    params: extensões GenAI (ttft_ms, tokens_per_second, custo etc.) — usadas na Fase 2.
    """

    __tablename__ = "archetypes_config"

    archetype: Mapped[str] = mapped_column(String(64), primary_key=True)
    archetype_class: Mapped[str] = mapped_column(String(32))
    label: Mapped[str] = mapped_column(String(64))
    category: Mapped[str] = mapped_column(String(32))  # grupo da palette
    base_rps: Mapped[int | None] = mapped_column(default=None)
    base_latency_ms: Mapped[float] = mapped_column(default=0)
    params: Mapped[dict] = mapped_column(JSONB, default=dict)
    version: Mapped[int] = mapped_column(default=1)
