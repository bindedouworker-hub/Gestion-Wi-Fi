"""Resupply request model — vendor requests for ticket stock."""

import enum
from datetime import datetime

from sqlalchemy import Integer, String, ForeignKey, Enum, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ResupplyStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ResupplyRequest(Base):
    __tablename__ = "resupply_requests"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    subscription_type_id: Mapped[int] = mapped_column(
        ForeignKey("subscription_types.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[ResupplyStatus] = mapped_column(
        Enum(ResupplyStatus), default=ResupplyStatus.PENDING, nullable=False, index=True
    )
    processed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    vendor = relationship("User", back_populates="resupply_requests", foreign_keys=[vendor_id])
    subscription_type = relationship("SubscriptionType", back_populates="resupply_requests")
    processor = relationship("User", foreign_keys=[processed_by])

    def __repr__(self) -> str:
        return f"<ResupplyRequest #{self.id} - {self.quantity} tickets ({self.status.value})>"
