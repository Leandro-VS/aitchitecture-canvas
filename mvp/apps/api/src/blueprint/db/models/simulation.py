import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin


class SimulationRun(Base, TimestampMixin):
    """Histórico de simulações — a mais recente entra na serialização do Juiz
    (Fase 4) e no pré-ADR (Fase 6)."""

    __tablename__ = "simulation_runs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    diagram_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("diagrams.id", ondelete="CASCADE"), index=True
    )
    params: Mapped[dict] = mapped_column(JSONB)
    metrics: Mapped[dict] = mapped_column(JSONB)
