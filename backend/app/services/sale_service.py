"""Sale service — selling tickets (FIFO) and cancellation."""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.sale import Sale
from app.models.ticket import Ticket, TicketStatus
from app.services.ticket_service import get_vendor_next_ticket


def create_sale(
    db: Session,
    vendor_id: int,
    subscription_type_id: int,
    payment_method: str,
    client_name: str | None = None,
    client_phone: str | None = None,
) -> Sale:
    """
    Create a sale by auto-assigning the next available ticket (FIFO).
    """
    ticket = get_vendor_next_ticket(db, vendor_id, subscription_type_id)
    if not ticket:
        raise ValueError("Aucun ticket disponible pour ce type d'abonnement")

    # Mark ticket as sold
    ticket.status = TicketStatus.SOLD
    ticket.sold_at = datetime.now(timezone.utc)

    # Get price from subscription type
    amount = float(ticket.subscription_type.price)

    sale = Sale(
        ticket_id=ticket.id,
        vendor_id=vendor_id,
        client_name=client_name,
        client_phone=client_phone,
        payment_method=payment_method,
        amount=amount,
    )
    db.add(sale)
    db.commit()
    db.refresh(sale)
    return sale


def cancel_sale(
    db: Session,
    sale_id: int,
    cancelled_by: int,
    reason: str,
) -> Sale:
    """Cancel a sale (admin only). The ticket goes back to assigned status."""
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise ValueError("Vente introuvable")
    if sale.is_cancelled:
        raise ValueError("Cette vente est déjà annulée")

    sale.is_cancelled = True
    sale.cancelled_by = cancelled_by
    sale.cancel_reason = reason
    sale.cancelled_at = datetime.now(timezone.utc)

    # Restore ticket to assigned status
    ticket = db.query(Ticket).filter(Ticket.id == sale.ticket_id).first()
    if ticket:
        ticket.status = TicketStatus.ASSIGNED
        ticket.sold_at = None

    db.commit()
    db.refresh(sale)
    return sale
