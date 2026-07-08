"""Sale model — records of ticket sales."""

from datetime import datetime

from sqlalchemy import String, ForeignKey, Numeric, Boolean, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Sale(Base):
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id"), unique=True, nullable=False)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    client_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    client_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    payment_method: Mapped[str] = mapped_column(String(50), nullable=False, default="cash")
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    is_cancelled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    cancelled_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    ticket = relationship("Ticket", back_populates="sale")
    vendor = relationship("User", back_populates="sales", foreign_keys=[vendor_id])
    canceller = relationship("User", foreign_keys=[cancelled_by])

    def __repr__(self) -> str:
        return f"<Sale #{self.id} - {self.payment_method}>"
