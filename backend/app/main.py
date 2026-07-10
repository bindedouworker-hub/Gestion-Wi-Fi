"""Adven's Manager — FastAPI application entry point."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import engine, SessionLocal, Base
from app.models import *  # noqa: F401, F403 — import all models to register them
from app.core.security import hash_password

settings = get_settings()


def seed_initial_data():
    """Create initial admin account and default payment methods if they don't exist."""
    from app.models.user import User, UserRole
    from app.models.payment_method import PaymentMethod
    from app.models.subscription_type import SubscriptionType

    db = SessionLocal()
    try:
        # Create admin user
        admin = db.query(User).filter(User.username == settings.INITIAL_ADMIN_USERNAME).first()
        if not admin:
            admin = User(
                username=settings.INITIAL_ADMIN_USERNAME,
                full_name="Administrateur",
                phone=settings.INITIAL_ADMIN_PHONE,
                password_hash=hash_password(settings.INITIAL_ADMIN_PASSWORD),
                role=UserRole.ADMIN,
            )
            db.add(admin)
            print(f"✅ Compte admin créé: {settings.INITIAL_ADMIN_USERNAME}")

        # Default payment methods
        for name in ["Espèces", "Wave", "Crédit"]:
            existing = db.query(PaymentMethod).filter(PaymentMethod.name == name).first()
            if not existing:
                method = PaymentMethod(name=name, is_active=True)
                db.add(method)
                print(f"✅ Moyen de paiement créé: {name}")

        # Default subscription types
        defaults = [
            ("24 Heures", 24, 1000),
            ("7 Jours", 168, 3000),
            ("30 Jours", 720, 10000),
        ]
        for name, hours, price in defaults:
            existing = db.query(SubscriptionType).filter(SubscriptionType.name == name).first()
            if not existing:
                st = SubscriptionType(name=name, duration_hours=hours, price=price)
                db.add(st)
                print(f"✅ Type d'abonnement créé: {name} — {price} FCFA")

        # Cleanup unused default types
        from app.models.ticket import Ticket
        for name in ["1 Heure", "3 Heures"]:
            st = db.query(SubscriptionType).filter(SubscriptionType.name == name).first()
            if st:
                has_tickets = db.query(Ticket).filter(Ticket.subscription_type_id == st.id).first() is not None
                if not has_tickets:
                    db.delete(st)
                    print(f"🧹 Type d'abonnement nettoyé: {name}")

        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # Create tables
    Base.metadata.create_all(bind=engine)
    print("✅ Base de données initialisée")

    # Create upload directory
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

    # Seed initial data
    seed_initial_data()

    yield

    print("👋 Application arrêtée")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Application de gestion des tickets Wi-Fi pour Adven's Center",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploads
upload_path = Path(settings.UPLOAD_DIR)
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")

# Register routers
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.tickets import router as tickets_router
from app.api.sales import router as sales_router
from app.api.resupply import router as resupply_router
from app.api.dashboard import router as dashboard_router
from app.api.reports import router as reports_router
from app.api.settings import router as settings_router

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(tickets_router)
app.include_router(sales_router)
app.include_router(resupply_router)
app.include_router(dashboard_router)
app.include_router(reports_router)
app.include_router(settings_router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}
