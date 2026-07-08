"""Batch model — a group of imported Wi-Fi tickets."""

from datetime import datetime

from sqlalchemy import String, Integer, Text, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Batch(Base):
    __tablename__ = "batches"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    reference: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    admin_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    subscription_type_id: Mapped[int] = mapped_column(
        ForeignKey("subscription_types.id"), nullable=False
    )
    total_tickets: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    admin = relationship("User", back_populates="batches", foreign_keys=[admin_id])
    subscription_type = relationship("SubscriptionType", back_populates="batches")
    tickets = relationship("Ticket", back_populates="batch", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Batch {self.reference} ({self.total_tickets} tickets)>"
