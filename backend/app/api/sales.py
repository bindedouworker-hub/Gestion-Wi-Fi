"""Sales API — sell tickets, cancel sales, history."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.core.dependencies import get_current_user, get_current_admin
from app.models.user import User, UserRole
from app.models.sale import Sale
from app.models.ticket import Ticket
from app.schemas.sale import SaleCreate, SaleResponse, SaleCancelRequest, ClientStatsResponse
from app.services.sale_service import create_sales, cancel_sale

router = APIRouter(prefix="/api/sales", tags=["Sales"])


@router.post("/", response_model=list[SaleResponse], status_code=201)
def sell_tickets(
    data: SaleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Sell one or more tickets (vendor or admin)."""
    try:
        sales = create_sales(
            db=db,
            vendor_id=current_user.id,
            subscription_type_id=data.subscription_type_id,
            payment_method=data.payment_method,
            client_name=data.client_name,
            client_phone=data.client_phone,
            ticket_ids=data.ticket_ids,
            quantity=data.quantity,
            allow_compensation=(current_user.role == UserRole.ADMIN),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    from app.utils.audit import log_action
    for sale in sales:
        log_action(
            db=db,
            user_id=current_user.id,
            action="sale.create",
            entity_type="sale",
            entity_id=sale.id,
            details={"ticket_code": sale.ticket.code, "amount": float(sale.amount), "payment_method": sale.payment_method},
        )

    # Build response list
    result = []
    for sale in sales:
        response = SaleResponse.model_validate(sale)
        response.ticket_code = sale.ticket.code
        response.vendor_name = current_user.full_name
        response.subscription_type_name = sale.ticket.subscription_type.name
        response.subscription_duration_hours = sale.ticket.subscription_type.duration_hours
        result.append(response)
    return result


@router.get("/", response_model=list[SaleResponse])
def list_sales(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    vendor_id: int | None = None,
    payment_method: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List sales with filters."""
    query = db.query(Sale)

    # Vendors see only their own sales
    if current_user.role == UserRole.VENDOR:
        query = query.filter(Sale.vendor_id == current_user.id)
    elif vendor_id:
        query = query.filter(Sale.vendor_id == vendor_id)

    if payment_method:
        query = query.filter(Sale.payment_method == payment_method)

    sales = query.order_by(Sale.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    result = []
    for sale in sales:
        data = SaleResponse.model_validate(sale)
        data.ticket_code = sale.ticket.code
        data.vendor_name = sale.vendor.full_name
        data.subscription_type_name = sale.ticket.subscription_type.name
        data.subscription_duration_hours = sale.ticket.subscription_type.duration_hours
        result.append(data)
    return result


@router.get("/today-summary")
def today_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get today's sales summary."""
    from datetime import date, datetime, timezone

    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)

    query = db.query(Sale).filter(Sale.created_at >= today_start, Sale.is_cancelled == False)

    if current_user.role == UserRole.VENDOR:
        query = query.filter(Sale.vendor_id == current_user.id)

    sales = query.all()

    return {
        "total_sales": len(sales),
        "total_revenue": sum(float(s.amount) for s in sales),
        "cash_total": sum(float(s.amount) for s in sales if s.payment_method == "cash"),
        "wave_total": sum(float(s.amount) for s in sales if s.payment_method != "cash"),
    }


@router.post("/{sale_id}/cancel", response_model=SaleResponse)
def cancel(
    sale_id: int,
    data: SaleCancelRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Cancel a sale (admin only). Ticket returns to assigned status or defective status."""
    try:
        sale, new_ticket = cancel_sale(db, sale_id, admin.id, data.reason, data.mark_defective)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    from app.utils.audit import log_action
    log_action(
        db=db,
        user_id=admin.id,
        action="sale.cancel",
        entity_type="sale",
        entity_id=sale.id,
        details={"ticket_code": sale.ticket.code, "amount": float(sale.amount), "reason": data.reason},
    )

    response = SaleResponse.model_validate(sale)
    response.ticket_code = sale.ticket.code
    response.vendor_name = sale.vendor.full_name
    response.subscription_type_name = sale.ticket.subscription_type.name
    response.subscription_duration_hours = sale.ticket.subscription_type.duration_hours
    if new_ticket:
        response.replacement_ticket_code = new_ticket.code
    return response


@router.post("/{sale_id}/mark-paid", response_model=SaleResponse)
def mark_paid(
    sale_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a credit sale as paid."""
    try:
        from app.services.sale_service import mark_sale_as_paid
        sale = mark_sale_as_paid(db, sale_id)

        # Audit log
        from app.utils.audit import log_action
        log_action(
            db=db,
            user_id=current_user.id,
            action="sale.mark_paid",
            entity_type="sale",
            entity_id=sale.id,
            details={"ticket_code": sale.ticket.code, "amount": float(sale.amount)},
        )

        response = SaleResponse.model_validate(sale)
        response.ticket_code = sale.ticket.code
        response.vendor_name = sale.vendor.full_name
        response.subscription_type_name = sale.ticket.subscription_type.name
        response.subscription_duration_hours = sale.ticket.subscription_type.duration_hours
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/clients", response_model=list[ClientStatsResponse])
def get_clients_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List clients and their purchased ticket counts."""
    from sqlalchemy import func
    
    clients = (
        db.query(
            Sale.client_name,
            Sale.client_phone,
            func.count(Sale.id).label("tickets_bought")
        )
        .filter(
            Sale.is_cancelled == False,
            ((Sale.client_name != None) & (Sale.client_name != "")) |
            ((Sale.client_phone != None) & (Sale.client_phone != ""))
        )
        .group_by(Sale.client_name, Sale.client_phone)
        .order_by(func.count(Sale.id).desc())
        .all()
    )
    
    return [
        ClientStatsResponse(
            name=c.client_name,
            phone=c.client_phone,
            tickets_bought=c.tickets_bought
        )
        for c in clients
    ]
