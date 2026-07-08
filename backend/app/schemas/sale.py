"""Sale schemas for API request/response validation."""

from datetime import datetime
from pydantic import BaseModel, Field


class SaleCreate(BaseModel):
    subscription_type_id: int
    client_name: str | None = None
    client_phone: str | None = None
    payment_method: str = "cash"


class SaleCancelRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=500)


class SaleResponse(BaseModel):
    id: int
    ticket_id: int
    vendor_id: int
    client_name: str | None
    client_phone: str | None
    payment_method: str
    amount: float
    created_at: datetime
    is_cancelled: bool
    cancelled_by: int | None
    cancel_reason: str | None
    cancelled_at: datetime | None
    ticket_code: str | None = None
    vendor_name: str | None = None
    subscription_type_name: str | None = None

    model_config = {"from_attributes": True}
