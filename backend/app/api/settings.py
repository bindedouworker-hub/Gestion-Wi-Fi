"""Settings API — payment methods, Wave config, file uploads."""

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import get_settings
from app.core.dependencies import get_current_admin
from app.models.user import User
from app.models.payment_method import PaymentMethod
from app.schemas.report import PaymentMethodCreate, PaymentMethodUpdate, PaymentMethodResponse

router = APIRouter(prefix="/api/settings", tags=["Settings"])
settings = get_settings()


@router.get("/payment-methods", response_model=list[PaymentMethodResponse])
def list_payment_methods(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """List all payment methods."""
    methods = db.query(PaymentMethod).order_by(PaymentMethod.name).all()
    return [PaymentMethodResponse.model_validate(m) for m in methods]


@router.post("/payment-methods", response_model=PaymentMethodResponse, status_code=201)
def create_payment_method(
    data: PaymentMethodCreate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Create a payment method."""
    existing = db.query(PaymentMethod).filter(PaymentMethod.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ce moyen de paiement existe déjà")

    method = PaymentMethod(
        name=data.name,
        is_active=data.is_active,
        wave_merchant_number=data.wave_merchant_number,
    )
    db.add(method)
    db.commit()
    db.refresh(method)
    return PaymentMethodResponse.model_validate(method)


@router.put("/payment-methods/{method_id}", response_model=PaymentMethodResponse)
def update_payment_method(
    method_id: int,
    data: PaymentMethodUpdate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Update a payment method."""
    method = db.query(PaymentMethod).filter(PaymentMethod.id == method_id).first()
    if not method:
        raise HTTPException(status_code=404, detail="Moyen de paiement introuvable")

    if data.name is not None:
        method.name = data.name
    if data.is_active is not None:
        method.is_active = data.is_active
    if data.wave_merchant_number is not None:
        method.wave_merchant_number = data.wave_merchant_number

    db.commit()
    db.refresh(method)
    return PaymentMethodResponse.model_validate(method)


@router.delete("/payment-methods/{method_id}")
def delete_payment_method(
    method_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Delete a payment method."""
    method = db.query(PaymentMethod).filter(PaymentMethod.id == method_id).first()
    if not method:
        raise HTTPException(status_code=404, detail="Moyen de paiement introuvable")

    db.delete(method)
    db.commit()
    return {"message": f"Moyen de paiement '{method.name}' supprimé"}


@router.post("/payment-methods/{method_id}/upload-qr")
async def upload_wave_qr(
    method_id: int,
    file: UploadFile = File(...),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Upload a Wave QR code image for a payment method."""
    method = db.query(PaymentMethod).filter(PaymentMethod.id == method_id).first()
    if not method:
        raise HTTPException(status_code=404, detail="Moyen de paiement introuvable")

    # Validate file type
    if file.content_type not in ["image/png", "image/jpeg", "image/webp"]:
        raise HTTPException(status_code=400, detail="Format d'image non supporté (PNG, JPEG, WebP)")

    # Ensure upload directory exists
    upload_dir = Path(settings.UPLOAD_DIR) / "wave_qr"
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Save file
    ext = file.filename.split(".")[-1] if file.filename else "png"
    filename = f"wave_qr_{method_id}_{uuid.uuid4().hex[:8]}.{ext}"
    file_path = upload_dir / filename

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 5 Mo)")

    with open(file_path, "wb") as f:
        f.write(content)

    # Update method
    method.wave_qr_image_path = str(file_path)
    db.commit()
    db.refresh(method)

    return {
        "message": "QR code Wave uploadé",
        "path": str(file_path),
    }


@router.get("/payment-methods/active", response_model=list[PaymentMethodResponse])
def list_active_payment_methods(
    db: Session = Depends(get_db),
):
    """List active payment methods (no auth required for sale form)."""
    methods = db.query(PaymentMethod).filter(PaymentMethod.is_active == True).all()
    return [PaymentMethodResponse.model_validate(m) for m in methods]
