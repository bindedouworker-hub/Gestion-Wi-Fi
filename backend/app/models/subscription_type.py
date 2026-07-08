"""Subscription type model — Wi-Fi plan types (1h, 3h, 24h, etc.)."""

from datetime import datetime

from sqlalchemy import String, Integer, Numeric, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SubscriptionType(Base):
    __tablename__ = "subscription_types"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    duration_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    batches = relationship("Batch", back_populates="subscription_type")
    tickets = relationship("Ticket", back_populates="subscription_type")
    resupply_requests = relationship("ResupplyRequest", back_populates="subscription_type")

    def __repr__(self) -> str:
        return f"<SubscriptionType {self.name} - {self.price} FCFA>"
