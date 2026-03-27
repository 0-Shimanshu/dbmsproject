from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.deps.auth import CurrentUser, get_current_user
from app.models.models import User
from app.schemas.common import error_response, success_response
from app.services.banking import log_audit


router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    if not payload.username or not payload.password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_response("Username and password are required"))

    user = db.query(User).filter(User.username == payload.username, User.is_active.is_(True)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error_response("Invalid credentials"))

    token = create_access_token(
        {
            "userId": user.user_id,
            "username": user.username,
            "fullName": user.full_name,
            "role": user.role,
        }
    )

    log_audit(db, user.user_id, "USER_LOGIN", "user", user.user_id, "User logged in")
    db.commit()

    return success_response(
        data={
            "token": token,
            "user": {
                "userId": user.user_id,
                "username": user.username,
                "fullName": user.full_name,
                "email": user.email,
                "role": user.role,
            },
        },
        message="Login successful",
    )


@router.post("/logout")
def logout(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    log_audit(db, user.user_id, "USER_LOGOUT", "user", user.user_id, "User logged out")
    db.commit()
    return success_response(message="Logout successful")


@router.get("/me")
def me(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.user_id == user.user_id).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error_response("User not found"))

    return success_response(
        data={
            "user_id": db_user.user_id,
            "username": db_user.username,
            "full_name": db_user.full_name,
            "email": db_user.email,
            "role": db_user.role,
        }
    )


@router.get("/verify")
def verify(user: CurrentUser = Depends(get_current_user)):
    return success_response(
        data={
            "userId": user.user_id,
            "username": user.username,
            "fullName": user.full_name,
            "role": user.role,
        }
    )
