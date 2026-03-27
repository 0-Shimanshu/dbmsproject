from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.models import User


class CurrentUser:
    def __init__(self, user_id: int, username: str, full_name: str, role: str):
        self.user_id = user_id
        self.username = username
        self.full_name = full_name
        self.role = role


ROLE_ALL = {"admin", "manager", "teller", "auditor"}


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> CurrentUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access token required")

    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_access_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    user_id = payload.get("userId")
    user = db.query(User).filter(User.user_id == user_id, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return CurrentUser(user.user_id, user.username, user.full_name, user.role)


def require_roles(*roles: str):
    allowed = set(roles)

    def dependency(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return dependency


def any_authenticated(user: CurrentUser = Depends(require_roles(*ROLE_ALL))) -> CurrentUser:
    return user
