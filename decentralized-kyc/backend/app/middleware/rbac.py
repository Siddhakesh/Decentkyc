"""
app/middleware/rbac.py
───────────────────────
Role-Based Access Control (RBAC) FastAPI dependency.

ZERO-TRUST DESIGN:
- Every protected endpoint explicitly declares the roles it permits.
- The token is re-validated on EVERY request (no session caching server-side).
- Role is embedded in the JWT at issuance and cannot be changed without re-login.
- The dependency raises 401 for missing/invalid tokens and 403 for wrong role.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session
from typing import List

from app.core.security import decode_access_token
from app.db.database import get_db, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Validate JWT and return the current authenticated user from DB.
    Raises 401 if token is invalid or expired.
    """
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if user is None:
        raise credentials_exc
    return user


def require_roles(*roles: str):
    """
    Factory that returns a FastAPI dependency enforcing one of the given roles.

    Usage:
        @router.post("/upload-kyc")
        async def upload_kyc(user = Depends(require_roles("user", "validator"))):
            ...
    """
    async def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role.value not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role.value}' is not authorised for this action. "
                       f"Required: {list(roles)}",
            )
        return current_user
    return role_checker


# ── Convenience shortcuts ─────────────────────────────────────────────────────
require_user      = require_roles("user")
require_bank      = require_roles("bank")
require_validator = require_roles("validator")
require_any       = require_roles("user", "bank", "validator")
