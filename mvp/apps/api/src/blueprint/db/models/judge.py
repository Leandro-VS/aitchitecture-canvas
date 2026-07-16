import datetime as dt
import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin


class JudgeRun(Base, TimestampMixin):
    __tablename__ = "judge_runs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    diagram_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("diagrams.id", ondelete="CASCADE"), index=True
    )
    canvas_hash: Mapped[str] = mapped_column(String(64), index=True)
    corpus_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="queued")
    # queued | running | done | failed
    cached: Mapped[bool] = mapped_column(default=False)
    score: Mapped[int | None] = mapped_column(nullable=True)
    verdict: Mapped[str | None] = mapped_column(String(16), nullable=True)
    strengths: Mapped[list] = mapped_column(JSONB, default=list)
    error: Mapped[str | None] = mapped_column(nullable=True)


class JudgeFinding(Base):
    __tablename__ = "judge_findings"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("judge_runs.id", ondelete="CASCADE"), index=True
    )
    severity: Mapped[str] = mapped_column(String(16))
    basis: Mapped[str] = mapped_column(String(16))  # guideline | general
    citation: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    component_refs: Mapped[list] = mapped_column(JSONB, default=list)  # ids de nós resolvidos
    recommendation: Mapped[str] = mapped_column()
    feedback: Mapped[str | None] = mapped_column(String(4), nullable=True)  # up | down (H2)
    resolved_at: Mapped[dt.datetime | None] = mapped_column(nullable=True)
