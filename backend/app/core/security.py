from datetime import datetime, timedelta
from typing import Optional
import requests
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_jwks_cache: Optional[dict] = None


def _get_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache is None:
        resp = requests.get(f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json", timeout=10)
        resp.raise_for_status()
        _jwks_cache = resp.json()
    return _jwks_cache


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


def decode_supabase_token(token: str) -> Optional[dict]:
    """Verify and decode a Supabase-issued JWT using the project's JWKS public key."""
    try:
        jwks = _get_jwks()
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")

        key = None
        for k in jwks.get("keys", []):
            if k.get("kid") == kid:
                key = k
                break
        if key is None and jwks.get("keys"):
            key = jwks["keys"][0]

        if key is None:
            print("[JWT ERROR] No matching key found in JWKS")
            return None

        return jwt.decode(
            token,
            key,
            algorithms=["ES256", "RS256", "HS256"],
            audience="authenticated",
        )
    except JWTError as e:
        print(f"[JWT ERROR] {e}")
        return None
