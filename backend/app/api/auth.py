"""Authentication API — login, logout, password change."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import verify_password
from app.models.user import User
from app.schemas.user import LoginRequest, LoginResponse, UserResponse, UserPasswordChange
from app.services.auth_service import authenticate_user, create_token_for_user, change_user_password

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=LoginResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user and return JWT token."""
    user = authenticate_user(db, credentials.username, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nom d'utilisateur ou mot de passe incorrect",
        )
    token = create_token_for_user(user)

    from app.utils.audit import log_action
    log_action(
        db=db,
        user_id=user.id,
        action="auth.login",
        entity_type="user",
        entity_id=user.id,
        details={"username": user.username, "role": user.role},
    )

    return LoginResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/change-password")
def change_password(
    data: UserPasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the current user's password."""
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mot de passe actuel incorrect",
        )
    change_user_password(db, current_user, data.new_password)

    from app.utils.audit import log_action
    log_action(
        db=db,
        user_id=current_user.id,
        action="auth.change_password",
        entity_type="user",
        entity_id=current_user.id,
        details={"username": current_user.username},
    )

    return {"message": "Mot de passe modifié avec succès"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return UserResponse.model_validate(current_user)
