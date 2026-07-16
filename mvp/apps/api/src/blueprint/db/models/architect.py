import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin


class ArchitectMessage(Base, TimestampMixin):
    """Histórico do chat do Arquiteto por diagrama, incluindo diffs propostos
    e o desfecho de cada um (métrica H3: taxa de aceite)."""

    __tablename__ = "architect_messages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    diagram_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("diagrams.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    proposed_diff: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    diff_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # proposed | applied | dismissed
