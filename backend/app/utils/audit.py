from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog

def log_action(
    db: Session,
    user_id: int,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    details: dict | None = None,
    ip_address: str | None = None,
):
    """Log an action in the database for audit traceability."""
    try:
        log_entry = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            ip_address=ip_address,
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        db.rollback()
        # In a real app we might log this with python's logging module
        print(f"Error logging action: {e}")
