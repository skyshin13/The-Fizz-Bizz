from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.security import decode_supabase_token
from app.models.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_supabase_token(token)
    if not payload:
        raise credentials_exception

    supabase_id: str = payload.get("sub")
    email: str = payload.get("email", "")
    if not supabase_id:
        raise credentials_exception

    # Find existing user by supabase_id
    user = db.query(User).filter(User.supabase_id == supabase_id).first()

    if not user:
        # Auto-create local user on first Supabase login
        user_metadata = payload.get("user_metadata") or {}
        username = user_metadata.get("username") or email.split("@")[0]
        display_name = user_metadata.get("display_name") or username

        # Ensure username uniqueness
        base = username
        counter = 1
        while db.query(User).filter(User.username == username).first():
            username = f"{base}{counter}"
            counter += 1

        user = User(
            supabase_id=supabase_id,
            email=email,
            username=username,
            hashed_password="",  # auth is handled by Supabase
            display_name=display_name,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return user
