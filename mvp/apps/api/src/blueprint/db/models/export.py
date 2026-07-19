import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin


class Export(Base, TimestampMixin):
    """Histórico de exports por diagrama (artefatos no MinIO/S3)."""

    __tablename__ = "exports"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    diagram_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("diagrams.id", ondelete="CASCADE"), index=True
    )
    format: Mapped[str] = mapped_column(String(8), default="md")
    s3_key: Mapped[str] = mapped_column(String(300))  # do .md; .png e .mmd são irmãos
