"""
app/db/database.py
───────────────────
SQLAlchemy engine and table definitions.

Schema Overview:
 users        — registered users (role: user / bank / validator)
 kyc_records  — KYC metadata (IPFS CID, chain tx hash, expiry)
 access_logs  — immutable audit log of every consent event
"""

from datetime import datetime, timezone
from sqlalchemy import (
    create_engine, Column, String, Boolean, DateTime,
    Integer, Text, ForeignKey, Enum
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
import enum

from app.core.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite only; remove for Postgres
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── Enums ─────────────────────────────────────────────────────────────────────
class UserRole(str, enum.Enum):
    user = "user"
    bank = "bank"
    validator = "validator"


class ConsentStatus(str, enum.Enum):
    pending = "pending"
    granted = "granted"
    revoked = "revoked"


class AuditEventType(str, enum.Enum):
    kyc_registered = "kyc_registered"
    kyc_verified = "kyc_verified"
    access_requested = "access_requested"
    consent_granted = "consent_granted"
    consent_revoked = "consent_revoked"
    document_accessed = "document_accessed"
    liveness_check = "liveness_check"


# ── Database Models ───────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"
    __table_args__ = {"extend_existing": True}

    id             = Column(String, primary_key=True)           # UUID
    email          = Column(String, unique=True, nullable=False, index=True)
    hashed_password= Column(String, nullable=False)
    full_name      = Column(String, nullable=True)
    role           = Column(Enum(UserRole), nullable=False, default=UserRole.user)
    wallet_address = Column(String, nullable=True, index=True)  # Ethereum address
    
    # ── Bank Marketplace Metadata ────────────────────────────────────────────
    description    = Column(Text, nullable=True)                # Profile bio
    services       = Column(String, nullable=True)              # Comma-separated or JSON list
    
    is_active      = Column(Boolean, default=True)
    created_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    kyc_record     = relationship("KYCRecord", back_populates="user", uselist=False)


class KYCRecord(Base):
    __tablename__ = "kyc_records"
    __table_args__ = {"extend_existing": True}

    id             = Column(String, primary_key=True)           # UUID
    user_id        = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    ipfs_cid       = Column(String, nullable=False)             # Encrypted doc CID
    kyc_hash       = Column(String, nullable=False)             # SHA-256(CID) stored on chain
    tx_hash        = Column(String, nullable=True)              # Blockchain TX hash
    doc_type       = Column(String, nullable=False, default="passport")  # passport, aadhar, etc.
    is_verified    = Column(Boolean, default=False)
    uploaded_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at     = Column(DateTime, nullable=True)
    fraud_score    = Column(Integer, nullable=True)             # 0-100 from AI scanner
    liveness_score = Column(Integer, nullable=True)             # 0-100 from CV scanner
    liveness_verified = Column(Boolean, default=False)

    user           = relationship("User", back_populates="kyc_record")


class ConsentRecord(Base):
    __tablename__ = "consent_records"
    __table_args__ = {"extend_existing": True}

    id             = Column(String, primary_key=True)           # UUID
    user_id        = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    bank_id        = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    status         = Column(Enum(ConsentStatus), default=ConsentStatus.pending)
    tx_hash        = Column(String, nullable=True)              # Grant/revoke TX hash
    requested_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    granted_at     = Column(DateTime, nullable=True)
    revoked_at     = Column(DateTime, nullable=True)
    signature      = Column(Text, nullable=True)                # User's Ethereum signature


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = {"extend_existing": True}

    id             = Column(String, primary_key=True)           # UUID
    actor_id       = Column(String, nullable=False)             # Who performed the action
    target_user_id = Column(String, nullable=True)              # Whose KYC was affected
    event_type     = Column(Enum(AuditEventType), nullable=False)
    tx_hash        = Column(String, nullable=True)              # On-chain TX (if applicable)
    ip_address     = Column(String, nullable=True)
    details        = Column(Text, nullable=True)                # JSON blob of extra context
    created_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc))


def create_tables():
    """Create all tables. Called on app startup."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency for database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
