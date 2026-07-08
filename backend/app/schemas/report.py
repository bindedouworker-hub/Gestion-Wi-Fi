"""Report schemas."""

from datetime import date
from pydantic import BaseModel


class ReportRequest(BaseModel):
    report_type: str = "daily"  # daily, weekly, monthly, custom
    start_date: date | None = None
    end_date: date | None = None
    vendor_id: int | None = None
    format: str = "pdf"  # pdf, excel


class DashboardStats(BaseModel):
    central_stock: int = 0
    vendor_stock: int = 0
    today_sales: int = 0
    today_revenue: float = 0
    cash_payments: float = 0
    wave_payments: float = 0
    pending_requests: int = 0
    total_vendors: int = 0
    total_tickets: int = 0
    total_sold: int = 0


class PaymentMethodResponse(BaseModel):
    id: int
    name: str
    is_active: bool
    wave_merchant_number: str | None
    wave_qr_image_path: str | None

    model_config = {"from_attributes": True}


class PaymentMethodCreate(BaseModel):
    name: str
    is_active: bool = True
    wave_merchant_number: str | None = None


class PaymentMethodUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None
    wave_merchant_number: str | None = None
