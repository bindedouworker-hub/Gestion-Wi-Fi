"""Authentication service — login, password management."""

from sqlalchemy.orm import Session

from app.models.user import User
from app.core.security import verify_password, hash_password, create_access_token


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    """Authenticate a user by username and password."""
    user = db.query(User).filter(User.username == username).first()
    if not user or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def create_token_for_user(user: User) -> str:
    """Create a JWT access token for the given user."""
    return create_access_token(
        data={"sub": str(user.id), "role": user.role.value, "username": user.username}
    )


def change_user_password(db: Session, user: User, new_password: str) -> None:
    """Change a user's password."""
    user.password_hash = hash_password(new_password)
    db.commit()
