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

    # Totals and Extra detailed stats (admin only)
    total_vendors = 0
    total_tickets = 0
    total_sold = 0
    top_client_name = None
    top_client_tickets = 0
    top_vendor_name = None
    top_vendor_tickets = 0
    top_subscription_type_name = None
    top_subscription_type_tickets = 0
    top_day_name = None
    top_day_tickets = 0

    if is_admin:
        total_vendors = db.query(func.count(User.id)).filter(
            User.role == UserRole.VENDOR, User.is_active == True
        ).scalar() or 0
        total_tickets = db.query(func.count(Ticket.id)).scalar() or 0
        total_sold = db.query(func.count(Ticket.id)).filter(
            Ticket.status == TicketStatus.SOLD
        ).scalar() or 0

        # Top Client
        top_client = (
            db.query(Sale.client_name, Sale.client_phone, func.count(Sale.id).label("count"))
            .filter(Sale.is_cancelled == False, Sale.client_name != None, Sale.client_name != "")
            .group_by(Sale.client_name, Sale.client_phone)
            .order_by(func.count(Sale.id).desc())
            .first()
        )
        if top_client:
            top_client_name = f"{top_client.client_name} ({top_client.client_phone})" if top_client.client_phone else top_client.client_name
            top_client_tickets = top_client.count

        # Top Vendor
        top_vendor = (
            db.query(User.full_name, func.count(Sale.id).label("count"))
            .join(Sale, Sale.vendor_id == User.id)
            .filter(Sale.is_cancelled == False)
            .group_by(User.full_name)
            .order_by(func.count(Sale.id).desc())
            .first()
        )
        if top_vendor:
            top_vendor_name = top_vendor.full_name
            top_vendor_tickets = top_vendor.count

        # Top Subscription Type
        from app.models.subscription_type import SubscriptionType
        top_sub_type = (
            db.query(SubscriptionType.name, func.count(Sale.id).label("count"))
            .join(Ticket, Ticket.id == Sale.ticket_id)
            .join(SubscriptionType, SubscriptionType.id == Ticket.subscription_type_id)
            .filter(Sale.is_cancelled == False)
            .group_by(SubscriptionType.name)
            .order_by(func.count(Sale.id).desc())
            .first()
        )
        if top_sub_type:
            top_subscription_type_name = top_sub_type.name
            top_subscription_type_tickets = top_sub_type.count

        # Top Day (agnostic weekday aggregation in Python)
        all_sales_dates = (
            db.query(Sale.created_at)
            .filter(Sale.is_cancelled == False)
            .all()
        )
        from collections import Counter
        days_count = Counter()
        day_names = {
            0: "Lundi",
            1: "Mardi",
            2: "Mercredi",
            3: "Jeudi",
            4: "Vendredi",
            5: "Samedi",
            6: "Dimanche"
        }
        for s in all_sales_dates:
            day_idx = s.created_at.weekday()
            days_count[day_idx] += 1
            
        if days_count:
            top_day_idx, top_day_count = days_count.most_common(1)[0]
            top_day_name = day_names[top_day_idx]
            top_day_tickets = top_day_count

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
        top_client_name=top_client_name,
        top_client_tickets=top_client_tickets,
        top_vendor_name=top_vendor_name,
        top_vendor_tickets=top_vendor_tickets,
        top_subscription_type_name=top_subscription_type_name,
        top_subscription_type_tickets=top_subscription_type_tickets,
        top_day_name=top_day_name,
        top_day_tickets=top_day_tickets,
    )
