"""Ticket model — individual Wi-Fi access codes."""

import enum
from datetime import datetime

from sqlalchemy import String, ForeignKey, Enum, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TicketStatus(str, enum.Enum):
    AVAILABLE = "available"
    ASSIGNED = "assigned"
    SOLD = "sold"
    DEFECTIVE = "defective"


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"), nullable=False)
    subscription_type_id: Mapped[int] = mapped_column(
        ForeignKey("subscription_types.id"), nullable=False
    )
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus), default=TicketStatus.AVAILABLE, nullable=False, index=True
    )
    assigned_to: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sold_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    batch = relationship("Batch", back_populates="tickets")
    subscription_type = relationship("SubscriptionType", back_populates="tickets")
    assigned_user = relationship("User", back_populates="assigned_tickets", foreign_keys=[assigned_to])
    sale = relationship("Sale", back_populates="ticket", uselist=False)

    def __repr__(self) -> str:
        return f"<Ticket {self.code} ({self.status.value})>"
