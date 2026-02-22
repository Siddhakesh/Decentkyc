"""
app/api/consent.py
───────────────────
Consent management endpoints.
POST /consent/request-access  — Bank requests access to a user's KYC
POST /consent/grant-access    — User grants consent (requires digital signature)
POST /consent/revoke-access   — User revokes previously granted consent
GET  /consent/pending         — List pending requests for current user
GET  /consent/status          — Check consent status between user and bank
"""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from eth_account import Account

from app.core.security import verify_eth_signature
from app.core.blockchain import blockchain_client
from app.core.config import get_settings
from app.db.database import (
    get_db, User, KYCRecord, ConsentRecord, AuditLog,
    ConsentStatus, AuditEventType
)
from app.middleware.rbac import require_bank, require_user, require_any, get_current_user
from app.models.schemas import (
    AccessRequest, GrantConsentRequest, RevokeConsentRequest, ConsentStatusOut
)

router = APIRouter(prefix="/consent", tags=["Consent Management"])
settings = get_settings()


@router.post("/request-access", status_code=status.HTTP_202_ACCEPTED)
async def request_access(
    body: AccessRequest,
    request: Request,
    current_user: User = Depends(require_bank),
    db: Session = Depends(get_db),
):
    """
    Bank requests access to a specific user's KYC.

    SECURITY:
    - Only users with the 'bank' role can call this endpoint.
    - KYC must exist and not be expired before a request can be made.
    - The request is also logged on-chain (if blockchain is live).
    """
    # Find the target user by wallet address
    target_user = db.query(User).filter(
        User.wallet_address == body.user_wallet_address,
        User.role == "user",
    ).first()

    if not target_user:
        raise HTTPException(status_code=404, detail="User wallet address not found")

    # Check that target user has a valid KYC record
    kyc = db.query(KYCRecord).filter(KYCRecord.user_id == target_user.id).first()
    if not kyc:
        raise HTTPException(status_code=404, detail="Target user has no KYC record")
    if kyc.expires_at and kyc.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Target user's KYC has expired")

    # Check for existing pending/granted request
    existing = db.query(ConsentRecord).filter(
        ConsentRecord.user_id == target_user.id,
        ConsentRecord.bank_id == current_user.id,
        ConsentRecord.status.in_([ConsentStatus.pending, ConsentStatus.granted]),
    ).first()
    if existing:
        raise HTTPException(
            status_code=409, detail=f"Access request already exists with status: {existing.status}"
        )

    # Create consent record
    consent = ConsentRecord(
        id=str(uuid.uuid4()),
        user_id=target_user.id,
        bank_id=current_user.id,
        status=ConsentStatus.pending,
    )
    db.add(consent)

    # Log on-chain (non-fatal)
    tx_hash = None
    if blockchain_client.is_connected() and current_user.wallet_address and settings.DEPLOYER_PRIVATE_KEY:
        try:
            bank_account = Account.from_key(settings.DEPLOYER_PRIVATE_KEY)
            tx_hash = blockchain_client.request_access(bank_account, body.user_wallet_address)
        except Exception as e:
            print(f"[Blockchain] requestAccess warning: {e}")

    db.add(AuditLog(
        id=str(uuid.uuid4()),
        actor_id=current_user.id,
        target_user_id=target_user.id,
        event_type=AuditEventType.access_requested,
        tx_hash=tx_hash,
        ip_address=request.client.host if request.client else None,
        details=f"Bank '{current_user.email}' requested KYC access",
    ))
    db.commit()

    return {"message": "Access request submitted. Awaiting user consent.", "consent_id": consent.id}


@router.post("/grant-access", response_model=ConsentStatusOut)
async def grant_access(
    body: GrantConsentRequest,
    request: Request,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """
    User grants consent to a bank after cryptographic signature verification.

    SECURITY (Critical Path):
    1. The client signs the consent message using their private key (MetaMask / ethers.js).
    2. Backend verifies the ECDSA signature against the user's stored wallet address.
    3. ONLY after successful verification does the backend call grantConsent() on-chain.
    4. This ensures consent cannot be granted by a stolen JWT alone —
       the user's private key must be involved (zero-trust consent layer).
    """
    # ── Step 1: Verify digital signature ────────────────────────────────────
    if not current_user.wallet_address:
        raise HTTPException(status_code=400, detail="User has no wallet address linked")

    # SECURITY: Verify the signature against stored wallet — not just the claim
    sig_valid = verify_eth_signature(
        message=body.consent_message,
        signature=body.signature,
        expected_address=current_user.wallet_address,
    )
    if not sig_valid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid digital signature. Consent rejected.",
        )

    # ── Step 2: Find consent record ──────────────────────────────────────────
    consent = db.query(ConsentRecord).filter(
        ConsentRecord.id == body.bank_id,  # bank_id field used as consent_id here for simplicity
    ).first()

    # Fallback: find by bank user_id
    if not consent:
        bank = db.query(User).filter(User.id == body.bank_id).first()
        if not bank:
            raise HTTPException(status_code=404, detail="Bank not found")
        consent = db.query(ConsentRecord).filter(
            ConsentRecord.user_id == current_user.id,
            ConsentRecord.bank_id == bank.id,
            ConsentRecord.status == ConsentStatus.pending,
        ).first()

    if not consent:
        raise HTTPException(status_code=404, detail="No pending access request found")
    if consent.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only grant consent for your own KYC")

    # ── Step 3: Update consent and call blockchain ───────────────────────────
    consent.status = ConsentStatus.granted
    consent.granted_at = datetime.now(timezone.utc)
    consent.signature = body.signature

    tx_hash = None
    if blockchain_client.is_connected() and settings.DEPLOYER_PRIVATE_KEY:
        try:
            user_account = Account.from_key(settings.DEPLOYER_PRIVATE_KEY)
            tx_hash = blockchain_client.grant_consent(user_account, body.bank_wallet_address)
            consent.tx_hash = tx_hash
        except Exception as e:
            print(f"[Blockchain] grantConsent warning: {e}")

    bank = db.query(User).filter(User.id == consent.bank_id).first()
    db.add(AuditLog(
        id=str(uuid.uuid4()),
        actor_id=current_user.id,
        target_user_id=current_user.id,
        event_type=AuditEventType.consent_granted,
        tx_hash=tx_hash,
        ip_address=request.client.host if request.client else None,
        details=f"Consent granted to bank: {bank.email if bank else 'unknown'}",
    ))
    db.commit()
    db.refresh(consent)
    return consent


@router.post("/revoke-access")
async def revoke_access(
    body: RevokeConsentRequest,
    request: Request,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """
    User revokes consent. Takes effect immediately.

    SECURITY: Signature verification required to prevent cross-user revocation
    via stolen JWT. Zero-trust: revoke is instant, no grace period.
    """
    if not current_user.wallet_address:
        raise HTTPException(status_code=400, detail="User has no wallet address linked")

    sig_valid = verify_eth_signature(
        message=body.consent_message,
        signature=body.signature,
        expected_address=current_user.wallet_address,
    )
    if not sig_valid:
        raise HTTPException(status_code=403, detail="Invalid digital signature. Revocation rejected.")

    bank = db.query(User).filter(User.id == body.bank_id).first()
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")

    consent = db.query(ConsentRecord).filter(
        ConsentRecord.user_id == current_user.id,
        ConsentRecord.bank_id == bank.id,
        ConsentRecord.status == ConsentStatus.granted,
    ).first()
    if not consent:
        raise HTTPException(status_code=404, detail="No active consent to revoke")

    consent.status = ConsentStatus.revoked
    consent.revoked_at = datetime.now(timezone.utc)

    tx_hash = None
    if blockchain_client.is_connected() and settings.DEPLOYER_PRIVATE_KEY:
        try:
            user_account = Account.from_key(settings.DEPLOYER_PRIVATE_KEY)
            tx_hash = blockchain_client.revoke_consent(user_account, body.bank_wallet_address)
            consent.tx_hash = tx_hash
        except Exception as e:
            print(f"[Blockchain] revokeConsent warning: {e}")

    db.add(AuditLog(
        id=str(uuid.uuid4()),
        actor_id=current_user.id,
        target_user_id=current_user.id,
        event_type=AuditEventType.consent_revoked,
        tx_hash=tx_hash,
        ip_address=request.client.host if request.client else None,
        details=f"Consent revoked from bank: {bank.email}",
    ))
    db.commit()

    return {"message": "Consent revoked successfully. Bank access has been terminated."}


@router.get("/pending")
async def get_pending_requests(
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """List all pending consent requests for the current user."""
    requests = db.query(ConsentRecord).filter(
        ConsentRecord.user_id == current_user.id,
        ConsentRecord.status == ConsentStatus.pending,
    ).all()

    result = []
    for r in requests:
        bank = db.query(User).filter(User.id == r.bank_id).first()
        result.append({
            "consent_id": r.id,
            "bank_name": bank.full_name if bank else "Unknown",
            "bank_email": bank.email if bank else "Unknown",
            "requested_at": r.requested_at,
        })
@router.get("/granted-list")
async def get_granted_accesses(
    current_user: User = Depends(require_bank),
    db: Session = Depends(get_db),
):
    """List all users who have granted KYC access to this bank."""
    consents = db.query(ConsentRecord).filter(
        ConsentRecord.bank_id == current_user.id,
        ConsentRecord.status == ConsentStatus.granted,
    ).all()

    result = []
    for c in consents:
        u = db.query(User).filter(User.id == c.user_id).first()
        if u:
            result.append({
                "user_wallet_address": u.wallet_address,
                "user_full_name": u.full_name,
                "granted_at": c.granted_at,
                "tx_hash": c.tx_hash,
            })
    return result


@router.get("/view/{user_wallet_address}")
async def view_user_kyc(
    user_wallet_address: str,
    request: Request,
    current_user: User = Depends(require_bank),
    db: Session = Depends(get_db),
):
    """
    Allows a bank to view the decrypted KYC data of a user.
    ONLY works if the user has GRANTED access.
    """
    # 1. Find the target user
    target_user = db.query(User).filter(
        User.wallet_address == user_wallet_address,
        User.role == "user",
    ).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User wallet address not found")

    # 2. Verify active consent
    consent = db.query(ConsentRecord).filter(
        ConsentRecord.user_id == target_user.id,
        ConsentRecord.bank_id == current_user.id,
        ConsentRecord.status == ConsentStatus.granted,
    ).first()

    if not consent:
        raise HTTPException(
            status_code=403, 
            detail="Access Denied. User has not granted you active consent."
        )

    # 3. Fetch and decrypt the KYC record
    kyc = db.query(KYCRecord).filter(KYCRecord.user_id == target_user.id).first()
    if not kyc:
        raise HTTPException(status_code=404, detail="KYC record not found for this user")

    # Audit the access event
    db.add(AuditLog(
        id=str(uuid.uuid4()),
        actor_id=current_user.id,
        target_user_id=target_user.id,
        event_type=AuditEventType.access_history,
        ip_address=request.client.host if request.client else None,
        details=f"Bank '{current_user.email}' accessed decrypted KYC data",
    ))
    db.commit()

    # In a real system, the bank would decrypt locally using a shared key.
    # For this demo, we return the data from the server.
    return {
        "full_name": target_user.full_name,
        "email": target_user.email,
        "wallet_address": target_user.wallet_address,
        "kyc_status": kyc.status,
        "id_type": kyc.id_type,
        "id_number": kyc.id_number,
        "liveness_score": kyc.liveness_score,
        "last_verified": kyc.updated_at,
        "document_cid": kyc.ipfs_cid,
    }
