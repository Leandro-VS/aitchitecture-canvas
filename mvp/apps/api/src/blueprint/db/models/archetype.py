from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class ArchetypeConfig(Base):
    """Calibração nominal do simulador + metadados de palette.

    base_rps é work units/s de uma unidade Medium no perfil balanceado; nulo =
    origem sem capacidade própria. params aceita extensões como
    simulation_profile, ttft_ms e tokens_per_second.
    """

    __tablename__ = "archetypes_config"

    archetype: Mapped[str] = mapped_column(String(64), primary_key=True)
    archetype_class: Mapped[str] = mapped_column(String(32))
    label: Mapped[str] = mapped_column(String(64))
    description: Mapped[str] = mapped_column(String(320))
    category: Mapped[str] = mapped_column(String(32))  # grupo da palette
    base_rps: Mapped[int | None] = mapped_column(default=None)
    base_latency_ms: Mapped[float] = mapped_column(default=0)
    params: Mapped[dict] = mapped_column(JSONB, default=dict)
    version: Mapped[int] = mapped_column(default=1)
