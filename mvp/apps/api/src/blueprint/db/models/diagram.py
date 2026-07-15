import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin


class Diagram(Base, TimestampMixin):
    __tablename__ = "diagrams"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    intake: Mapped[dict] = mapped_column(JSONB)
    canvas_state: Mapped[dict] = mapped_column(JSONB, default=dict)  # nodes, edges, viewport
    # sha256(canvas_state + intake) — intake compõe o hash porque muda o veredito
    # dos juízes tanto quanto o grafo (chave de cache na Fase 4)
    canvas_hash: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(16), default="in_progress")
