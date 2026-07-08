"""Dashboard API — real-time statistics."""

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.ticket import Ticket, TicketStatus
from app.models.sale import Sale
from app.models.resupply import ResupplyRequest, ResupplyStatus
from app.schemas.report import DashboardStats

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/", response_model=DashboardStats)
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get dashboard statistics."""
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    is_admin = current_user.role == UserRole.ADMIN

    # Central stock (available tickets — not assigned)
    central_stock = db.query(func.count(Ticket.id)).filter(
        Ticket.status == TicketStatus.AVAILABLE
    ).scalar() or 0

    # Vendor stock
    if is_admin:
        vendor_stock = db.query(func.count(Ticket.id)).filter(
            Ticket.status == TicketStatus.ASSIGNED
        ).scalar() or 0
    else:
        vendor_stock = db.query(func.count(Ticket.id)).filter(
            Ticket.status == TicketStatus.ASSIGNED,
            Ticket.assigned_to == current_user.id,
        ).scalar() or 0

    # Today's sales
    sales_query = db.query(Sale).filter(
        Sale.created_at >= today_start,
        Sale.is_cancelled == False,
    )
    if not is_admin:
        sales_query = sales_query.filter(Sale.vendor_id == current_user.id)

    today_sales_list = sales_query.all()
    today_sales = len(today_sales_list)
    today_revenue = sum(float(s.amount) for s in today_sales_list)
    cash_payments = sum(float(s.amount) for s in today_sales_list if s.payment_method == "cash")
    wave_payments = sum(float(s.amount) for s in today_sales_list if s.payment_method != "cash")

    # Pending requests
    pending_query = db.query(func.count(ResupplyRequest.id)).filter(
        ResupplyRequest.status == ResupplyStatus.PENDING
    )
    if not is_admin:
        pending_query = pending_query.filter(ResupplyRequest.vendor_id == current_user.id)
    pending_requests = pending_query.scalar() or 0

    # Totals (admin only)
    total_vendors = 0
    total_tickets = 0
    total_sold = 0
    if is_admin:
        total_vendors = db.query(func.count(User.id)).filter(
            User.role == UserRole.VENDOR, User.is_active == True
        ).scalar() or 0
        total_tickets = db.query(func.count(Ticket.id)).scalar() or 0
        total_sold = db.query(func.count(Ticket.id)).filter(
            Ticket.status == TicketStatus.SOLD
        ).scalar() or 0

    return DashboardStats(
        central_stock=central_stock,
        vendor_stock=vendor_stock,
        today_sales=today_sales,
        today_revenue=today_revenue,
        cash_payments=cash_payments,
        wave_payments=wave_payments,
        pending_requests=pending_requests,
        total_vendors=total_vendors,
        total_tickets=total_tickets,
        total_sold=total_sold,
    )
