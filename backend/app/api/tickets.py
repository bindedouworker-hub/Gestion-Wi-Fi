"""Tickets API — batch import, assignment, search."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.core.dependencies import get_current_user, get_current_admin
from app.models.user import User, UserRole
from app.models.ticket import Ticket, TicketStatus
from app.models.batch import Batch
from app.models.subscription_type import SubscriptionType
from app.schemas.ticket import (
    BatchCreate, BatchResponse, TicketResponse, TicketAssign,
    TicketBulkAssign, SubscriptionTypeCreate, SubscriptionTypeUpdate, SubscriptionTypeResponse,
)
from app.services.ticket_service import (
    create_batch_with_tickets, assign_tickets_to_vendor, bulk_assign_tickets,
)

router = APIRouter(prefix="/api/tickets", tags=["Tickets"])


# --- Subscription Types ---
@router.get("/subscription-types", response_model=list[SubscriptionTypeResponse])
def list_subscription_types(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all subscription types."""
    types = db.query(SubscriptionType).order_by(SubscriptionType.name).all()
    return [SubscriptionTypeResponse.model_validate(t) for t in types]


@router.post("/subscription-types", response_model=SubscriptionTypeResponse, status_code=201)
def create_subscription_type(
    data: SubscriptionTypeCreate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Create a new subscription type (admin only)."""
    existing = db.query(SubscriptionType).filter(SubscriptionType.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ce type d'abonnement existe déjà")

    sub_type = SubscriptionType(name=data.name, duration_hours=data.duration_hours, price=data.price)
    db.add(sub_type)
    db.commit()
    db.refresh(sub_type)
    return SubscriptionTypeResponse.model_validate(sub_type)


@router.put("/subscription-types/{type_id}", response_model=SubscriptionTypeResponse)
def update_subscription_type(
    type_id: int,
    data: SubscriptionTypeUpdate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Update a subscription type (admin only)."""
    sub_type = db.query(SubscriptionType).filter(SubscriptionType.id == type_id).first()
    if not sub_type:
        raise HTTPException(status_code=404, detail="Type d'abonnement introuvable")

    if data.name is not None:
        sub_type.name = data.name
    if data.duration_hours is not None:
        sub_type.duration_hours = data.duration_hours
    if data.price is not None:
        sub_type.price = data.price
    if data.is_active is not None:
        sub_type.is_active = data.is_active

    db.commit()
    db.refresh(sub_type)
    return SubscriptionTypeResponse.model_validate(sub_type)


@router.delete("/subscription-types/{type_id}", status_code=204)
def delete_subscription_type(
    type_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Delete a subscription type (admin only)."""
    sub_type = db.query(SubscriptionType).filter(SubscriptionType.id == type_id).first()
    if not sub_type:
        raise HTTPException(status_code=404, detail="Type d'abonnement introuvable")

    # Check for references in other tables
    from app.models.batch import Batch
    from app.models.ticket import Ticket
    from app.models.resupply import ResupplyRequest

    has_batches = db.query(Batch).filter(Batch.subscription_type_id == type_id).first() is not None
    has_tickets = db.query(Ticket).filter(Ticket.subscription_type_id == type_id).first() is not None
    has_resupplies = db.query(ResupplyRequest).filter(ResupplyRequest.subscription_type_id == type_id).first() is not None

    if has_batches or has_tickets or has_resupplies:
        raise HTTPException(
            status_code=400,
            detail="Impossible de supprimer ce type d'abonnement car il contient des données historiques. Vous pouvez le désactiver pour le masquer."
        )

    db.delete(sub_type)
    db.commit()
    return None



# --- Batches ---
@router.get("/batches", response_model=list[BatchResponse])
def list_batches(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """List all batches (admin only)."""
    batches = (
        db.query(Batch)
        .order_by(Batch.created_at.desc())
        .all()
    )
    result = []
    for batch in batches:
        data = BatchResponse.model_validate(batch)
        data.subscription_type = SubscriptionTypeResponse.model_validate(batch.subscription_type)
        data.admin_name = batch.admin.full_name
        result.append(data)
    return result


@router.post("/batches", status_code=201)
def create_batch(
    data: BatchCreate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Import a batch of ticket codes (admin only)."""
    try:
        batch, duplicates = create_batch_with_tickets(
            db=db,
            reference=data.reference,
            subscription_type_id=data.subscription_type_id,
            codes=data.codes,
            admin_id=admin.id,
            notes=data.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "batch": BatchResponse.model_validate(batch),
        "imported": batch.total_tickets,
        "duplicates": duplicates,
        "duplicate_count": len(duplicates),
    }


# --- Tickets ---
@router.get("/", response_model=list[TicketResponse])
def list_tickets(
    status: str | None = None,
    subscription_type_id: int | None = None,
    batch_id: int | None = None,
    assigned_to: int | None = None,
    code: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List tickets with filters."""
    query = db.query(Ticket)

    # Vendors can only see their own tickets
    if current_user.role == UserRole.VENDOR:
        query = query.filter(Ticket.assigned_to == current_user.id)
    elif assigned_to:
        query = query.filter(Ticket.assigned_to == assigned_to)

    if status:
        query = query.filter(Ticket.status == status)
    if subscription_type_id:
        query = query.filter(Ticket.subscription_type_id == subscription_type_id)
    if batch_id:
        query = query.filter(Ticket.batch_id == batch_id)
    if code:
        query = query.filter(Ticket.code.ilike(f"%{code}%"))

    tickets = query.order_by(Ticket.id.desc()).offset((page - 1) * per_page).limit(per_page).all()

    result = []
    for ticket in tickets:
        data = TicketResponse.model_validate(ticket)
        data.subscription_type = SubscriptionTypeResponse.model_validate(ticket.subscription_type)
        data.batch_reference = ticket.batch.reference
        if ticket.assigned_user:
            data.assigned_user_name = ticket.assigned_user.full_name
        result.append(data)
    return result


@router.get("/search")
def search_ticket(
    code: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search for a specific ticket by code."""
    ticket = db.query(Ticket).filter(Ticket.code == code).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket introuvable")

    data = TicketResponse.model_validate(ticket)
    data.subscription_type = SubscriptionTypeResponse.model_validate(ticket.subscription_type)
    data.batch_reference = ticket.batch.reference
    if ticket.assigned_user:
        data.assigned_user_name = ticket.assigned_user.full_name
    return data


@router.post("/assign")
def assign_tickets(
    data: TicketAssign,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Assign specific tickets to a vendor (admin only)."""
    try:
        tickets = assign_tickets_to_vendor(db, data.ticket_ids, data.vendor_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": f"{len(tickets)} tickets attribués", "count": len(tickets)}


@router.post("/bulk-assign")
def bulk_assign(
    data: TicketBulkAssign,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Assign N tickets of a type to a vendor (admin only, FIFO)."""
    try:
        tickets = bulk_assign_tickets(db, data.vendor_id, data.subscription_type_id, data.quantity)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": f"{len(tickets)} tickets attribués", "count": len(tickets)}


@router.get("/stock-summary")
def stock_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get stock summary by subscription type."""
    sub_types = db.query(SubscriptionType).filter(SubscriptionType.is_active == True).all()

    result = []
    for st in sub_types:
        available = db.query(func.count(Ticket.id)).filter(
            Ticket.subscription_type_id == st.id,
            Ticket.status == TicketStatus.AVAILABLE,
        ).scalar() or 0

        if current_user.role == UserRole.ADMIN:
            assigned = db.query(func.count(Ticket.id)).filter(
                Ticket.subscription_type_id == st.id,
                Ticket.status == TicketStatus.ASSIGNED,
            ).scalar() or 0
            sold = db.query(func.count(Ticket.id)).filter(
                Ticket.subscription_type_id == st.id,
                Ticket.status == TicketStatus.SOLD,
            ).scalar() or 0
        else:
            assigned = db.query(func.count(Ticket.id)).filter(
                Ticket.subscription_type_id == st.id,
                Ticket.status == TicketStatus.ASSIGNED,
                Ticket.assigned_to == current_user.id,
            ).scalar() or 0
            sold = db.query(func.count(Ticket.id)).filter(
                Ticket.subscription_type_id == st.id,
                Ticket.status == TicketStatus.SOLD,
                Ticket.assigned_to == current_user.id,
            ).scalar() or 0

        result.append({
            "subscription_type": SubscriptionTypeResponse.model_validate(st),
            "available": available,
            "assigned": assigned,
            "sold": sold,
        })
    return result
