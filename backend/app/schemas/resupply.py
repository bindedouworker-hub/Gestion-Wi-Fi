"""Resupply request schemas."""

from datetime import datetime
from pydantic import BaseModel, Field


class ResupplyRequestCreate(BaseModel):
    subscription_type_id: int
    quantity: int = Field(..., gt=0)


class ResupplyProcessRequest(BaseModel):
    action: str = Field(..., pattern="^(approved|rejected)$")
    rejection_reason: str | None = None


class ResupplyRequestResponse(BaseModel):
    id: int
    vendor_id: int
    subscription_type_id: int
    quantity: int
    status: str
    processed_by: int | None
    rejection_reason: str | None
    created_at: datetime
    processed_at: datetime | None
    vendor_name: str | None = None
    subscription_type_name: str | None = None

    model_config = {"from_attributes": True}
