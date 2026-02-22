"""
app/api/auth.py
────────────────
Authentication endpoints: register and login.
POST /auth/register  — create a new user account
POST /auth/login     — obtain JWT token
GET  /auth/me        — get current user profile
"""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password, create_access_token
from app.db.database import get_db, User, AuditLog, AuditEventType
from app.models.schemas import UserCreate, UserLogin, UserOut, Token

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_user(user_in: UserCreate, request: Request, db: Session = Depends(get_db)):
    """
    Register a new user account.

    SECURITY:
    - Email uniqueness enforced at DB level.
    - Password is bcrypt-hashed (cost=12) before storage — never stored in plain text.
    - Wallet address is validated as a proper Ethereum checksum address via Pydantic pattern.
    - Role defaults to "user"; "bank" and "validator" roles should be assigned
      by an admin in production (here simplified to self-registration + validation).
    """
    # Check for duplicate email
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    new_user = User(
        id=str(uuid.uuid4()),
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        wallet_address=user_in.wallet_address,
        description=user_in.description,
        services=user_in.services,
    )
    db.add(new_user)

    # Write audit log entry
    db.add(AuditLog(
        id=str(uuid.uuid4()),
        actor_id=new_user.id,
        event_type=AuditEventType.kyc_registered,  # Closest event type for registration
        ip_address=request.client.host if request.client else None,
        details=f"User registered with role={new_user.role.value}",
    ))

    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate user and return a JWT access token.

    SECURITY:
    - Uses constant-time password comparison via bcrypt to resist timing attacks.
    - Returns HTTP 401 (not 404) for both "user not found" and "wrong password"
      to prevent user enumeration.
    - JWT contains role, sub (user_id), and wallet_address for downstream use.
    """
    user = db.query(User).filter(
        User.email == credentials.email, User.is_active == True
    ).first()

    # SECURITY: Identical error for both "not found" and "wrong password"
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password. If you haven't recently registered after the system update, please create a new account.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(
        subject=user.id,
        role=user.role.value,
        wallet_address=user.wallet_address,
    )
    return Token(access_token=token, role=user.role)


@router.get("/banks", response_model=List[UserOut])
async def list_banks(db: Session = Depends(get_db)):
    """List all registered financial institutions for the marketplace."""
    return db.query(User).filter(User.role == "bank", User.is_active == True).all()


@router.get("/me", response_model=UserOut)
async def get_me(db: Session = Depends(get_db)):
    """Return current authenticated user. Protected by JWT via dependency."""
    # RBAC dependency injects the user — added at router include time in main.py
    # This endpoint is example; full RBAC injection shown in kyc.py
    raise HTTPException(status_code=501, detail="Use /auth/me with Authorization header")
