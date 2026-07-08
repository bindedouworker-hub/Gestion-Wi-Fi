"""Resupply service — vendor stock requests and admin processing."""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.resupply import ResupplyRequest, ResupplyStatus
from app.services.ticket_service import bulk_assign_tickets


def create_resupply_request(
    db: Session,
    vendor_id: int,
    subscription_type_id: int,
    quantity: int,
) -> ResupplyRequest:
    """Create a new resupply request from a vendor."""
    # Check for existing pending request of same type
    existing = (
        db.query(ResupplyRequest)
        .filter(
            ResupplyRequest.vendor_id == vendor_id,
            ResupplyRequest.subscription_type_id == subscription_type_id,
            ResupplyRequest.status == ResupplyStatus.PENDING,
        )
        .first()
    )
    if existing:
        raise ValueError("Une demande en attente existe déjà pour ce type d'abonnement")

    request = ResupplyRequest(
        vendor_id=vendor_id,
        subscription_type_id=subscription_type_id,
        quantity=quantity,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


def process_resupply_request(
    db: Session,
    request_id: int,
    action: str,
    processed_by: int,
    rejection_reason: str | None = None,
) -> ResupplyRequest:
    """Approve or reject a resupply request."""
    request = db.query(ResupplyRequest).filter(ResupplyRequest.id == request_id).first()
    if not request:
        raise ValueError("Demande introuvable")
    if request.status != ResupplyStatus.PENDING:
        raise ValueError("Cette demande a déjà été traitée")

    now = datetime.now(timezone.utc)

    if action == "approved":
        # Assign tickets to the vendor
        try:
            bulk_assign_tickets(
                db,
                vendor_id=request.vendor_id,
                subscription_type_id=request.subscription_type_id,
                quantity=request.quantity,
            )
        except ValueError as e:
            raise ValueError(f"Impossible d'approuver : {e}")

        request.status = ResupplyStatus.APPROVED
    elif action == "rejected":
        if not rejection_reason:
            raise ValueError("Un motif de refus est requis")
        request.status = ResupplyStatus.REJECTED
        request.rejection_reason = rejection_reason
    else:
        raise ValueError("Action invalide")

    request.processed_by = processed_by
    request.processed_at = now
    db.commit()
    db.refresh(request)
    return request
