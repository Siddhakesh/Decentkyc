"""
app/models/schemas.py
──────────────────────
Pydantic request/response models — the API contract layer.
All inputs are validated here before reaching business logic.
"""

from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ── Enums ─────────────────────────────────────────────────────────────────────
class UserRole(str, Enum):
    user = "user"
    bank = "bank"
    validator = "validator"


class ConsentStatus(str, Enum):
    pending = "pending"
    granted = "granted"
    revoked = "revoked"


# ── Auth ──────────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(None, max_length=200)
    role: UserRole = UserRole.user
    wallet_address: Optional[str] = Field(None, pattern=r"^0x([a-fA-F0-9]{40}|DEMO_.*)$")
    description: Optional[str] = Field(None, max_length=1000)
    services: Optional[str] = Field(None, max_length=500)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    full_name: Optional[str]
    role: UserRole
    wallet_address: Optional[str]
    description: Optional[str]
    services: Optional[str]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole


# ── KYC ───────────────────────────────────────────────────────────────────────
class KYCUploadResponse(BaseModel):
    kyc_id: str
    ipfs_cid: str
    kyc_hash: str        # SHA-256 hash stored on chain
    tx_hash: Optional[str]
    expires_at: Optional[datetime]
    message: str


class LivenessRequest(BaseModel):
    image_b64: str = Field(..., description="Base64 encoded selfie image")


class LivenessResponse(BaseModel):
    is_live: bool
    score: int
    message: str


class KYCStatus(BaseModel):
    user_id: str
    ipfs_cid: str
    kyc_hash: str
    is_verified: bool
    uploaded_at: datetime
    expires_at: Optional[datetime]
    fraud_score: Optional[int]
    liveness_score: Optional[int]
    liveness_verified: bool = False

    model_config = {"from_attributes": True}


# ── Consent ───────────────────────────────────────────────────────────────────
class AccessRequest(BaseModel):
    user_wallet_address: str = Field(..., pattern=r"^0x([a-fA-F0-9]{40}|DEMO_.*)$")


class GrantConsentRequest(BaseModel):
    bank_id: str
    bank_wallet_address: str = Field(..., pattern=r"^0x([a-fA-F0-9]{40}|DEMO_.*)$")
    # SECURITY:
    # The client signs the message  "GRANT_CONSENT:<bank_wallet>:<timestamp>"
    # using MetaMask / ethers.js.  Backend verifies this before calling the contract.
    signature: str = Field(..., description="Ethereum signature from user's wallet")
    consent_message: str = Field(..., description="Exact message that was signed")


class RevokeConsentRequest(BaseModel):
    bank_id: str
    bank_wallet_address: str = Field(..., pattern=r"^0x([a-fA-F0-9]{40}|DEMO_.*)$")
    signature: str
    consent_message: str


class ConsentStatusOut(BaseModel):
    consent_id: str
    user_id: str
    bank_id: str
    status: ConsentStatus
    requested_at: datetime
    granted_at: Optional[datetime]
    revoked_at: Optional[datetime]
    tx_hash: Optional[str]

    model_config = {"from_attributes": True}


# ── Audit ─────────────────────────────────────────────────────────────────────
class AuditLogOut(BaseModel):
    id: str
    actor_id: str
    target_user_id: Optional[str]
    event_type: str
    tx_hash: Optional[str]
    ip_address: Optional[str]
    details: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogList(BaseModel):
    total: int
    logs: List[AuditLogOut]


# ── Health ────────────────────────────────────────────────────────────────────
class HealthCheck(BaseModel):
    status: str
    blockchain_connected: bool
    version: str
