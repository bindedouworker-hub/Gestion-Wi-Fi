"""Sale service — selling tickets (FIFO) and cancellation."""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.sale import Sale
from app.models.ticket import Ticket, TicketStatus
from app.services.ticket_service import get_vendor_next_ticket


def create_sales(
    db: Session,
    vendor_id: int,
    subscription_type_id: int,
    payment_method: str,
    client_name: str | None = None,
    client_phone: str | None = None,
    ticket_ids: list[int] | None = None,
    quantity: int = 1,
    allow_compensation: bool = False,
) -> list[Sale]:
    """
    Create one or more sales by auto-assigning next available tickets (FIFO) or using specific tickets.
    """
    from app.models.user import User, UserRole

    user = db.query(User).filter(User.id == vendor_id).first()
    is_admin = user is not None and user.role == UserRole.ADMIN

    if payment_method.lower() == "compensation" and not allow_compensation:
        raise ValueError("Seuls les administrateurs peuvent initier des ventes de dédommagement.")

    # 1. Retrieve the tickets to sell
    if ticket_ids is not None and len(ticket_ids) > 0:
        if is_admin:
            # Admins can sell any AVAILABLE ticket or any ASSIGNED ticket assigned to them
            tickets = db.query(Ticket).filter(
                Ticket.id.in_(ticket_ids),
                Ticket.subscription_type_id == subscription_type_id,
                ((Ticket.status == TicketStatus.AVAILABLE) |
                 ((Ticket.status == TicketStatus.ASSIGNED) & (Ticket.assigned_to == vendor_id)))
            ).all()
        else:
            # Vendors can only sell tickets assigned to them
            tickets = db.query(Ticket).filter(
                Ticket.id.in_(ticket_ids),
                Ticket.assigned_to == vendor_id,
                Ticket.subscription_type_id == subscription_type_id,
                Ticket.status == TicketStatus.ASSIGNED,
            ).all()
            
        if len(tickets) != len(ticket_ids):
            raise ValueError("Un ou plusieurs tickets sélectionnés ne sont pas disponibles ou ne vous sont pas attribués")
    else:
        if is_admin:
            # Admins get next AVAILABLE tickets from central stock (FIFO)
            tickets = db.query(Ticket).filter(
                Ticket.subscription_type_id == subscription_type_id,
                Ticket.status == TicketStatus.AVAILABLE
            ).order_by(Ticket.id).limit(quantity).all()
            
            # Fallback to assigned tickets if not enough available tickets in central stock
            if len(tickets) < quantity:
                remaining = quantity - len(tickets)
                assigned_tickets = db.query(Ticket).filter(
                    Ticket.assigned_to == vendor_id,
                    Ticket.subscription_type_id == subscription_type_id,
                    Ticket.status == TicketStatus.ASSIGNED,
                ).order_by(Ticket.id).limit(remaining).all()
                tickets.extend(assigned_tickets)
        else:
            # Vendors get next ASSIGNED tickets (FIFO)
            tickets = db.query(Ticket).filter(
                Ticket.assigned_to == vendor_id,
                Ticket.subscription_type_id == subscription_type_id,
                Ticket.status == TicketStatus.ASSIGNED,
            ).order_by(Ticket.id).limit(quantity).all()

        if len(tickets) < quantity:
            raise ValueError(f"Stock insuffisant : seulement {len(tickets)} ticket(s) disponible(s)")

    # 2. Record each sale
    sales = []
    now = datetime.now(timezone.utc)
    for ticket in tickets:
        ticket.status = TicketStatus.SOLD
        ticket.sold_at = now
        
        # Compensation / free tickets have 0.0 amount
        if payment_method.lower() == "compensation":
            amount = 0.0
        else:
            amount = float(ticket.subscription_type.price)
        
        is_paid = payment_method.lower() != "credit"
        sale = Sale(
            ticket_id=ticket.id,
            vendor_id=vendor_id,
            client_name=client_name,
            client_phone=client_phone,
            payment_method=payment_method,
            amount=amount,
            is_paid=is_paid,
        )
        db.add(sale)
        sales.append(sale)
        
    db.commit()
    for sale in sales:
        db.refresh(sale)
        
    return sales


def cancel_sale(
    db: Session,
    sale_id: int,
    cancelled_by: int,
    reason: str,
    mark_defective: bool = False,
) -> tuple[Sale, Ticket | None]:
    """Cancel a sale (admin only). The ticket goes back to assigned status or defective status."""
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise ValueError("Vente introuvable")
    if sale.is_cancelled:
        raise ValueError("Cette vente est déjà annulée")

    sale.is_cancelled = True
    sale.cancelled_by = cancelled_by
    sale.cancel_reason = reason
    sale.cancelled_at = datetime.now(timezone.utc)

    # Restore ticket to assigned status or mark as defective
    ticket = db.query(Ticket).filter(Ticket.id == sale.ticket_id).first()
    new_ticket = None
    if ticket:
        if mark_defective:
            ticket.status = TicketStatus.DEFECTIVE
            
            # Auto-assign replacement ticket
            try:
                replacement_client_name = f"{sale.client_name or 'Client'} (Remplacement #{sale.id})"
                replacement_sales = create_sales(
                    db=db,
                    vendor_id=sale.vendor_id,
                    subscription_type_id=ticket.subscription_type_id,
                    payment_method="compensation",
                    client_name=replacement_client_name,
                    client_phone=sale.client_phone,
                    quantity=1,
                    allow_compensation=True
                )
                if replacement_sales:
                    new_ticket = replacement_sales[0].ticket
            except ValueError as e:
                raise ValueError(
                    f"Le ticket a été marqué comme défectueux, mais la réattribution automatique a échoué par manque de stock : {str(e)}"
                )
        else:
            ticket.status = TicketStatus.ASSIGNED
        ticket.sold_at = None

    db.commit()
    db.refresh(sale)
    return sale, new_ticket


def mark_sale_as_paid(db: Session, sale_id: int) -> Sale:
    """Mark a credit sale as paid."""
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise ValueError("Vente introuvable")
    if sale.is_paid:
        raise ValueError("Cette vente est déjà payée")
    sale.is_paid = True
    sale.paid_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sale)
    return sale
