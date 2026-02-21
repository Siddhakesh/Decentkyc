"""
app/core/security.py
─────────────────────
Cryptographic utilities for the KYC platform.

SECURITY DESIGN CHOICES:
 ┌───────────────────────────────────────────────────────────────────────┐
 │ 1. AES-256-GCM  — Authenticated encryption (provides both            │
 │    confidentiality AND integrity). We use GCM mode over CBC to defend │
 │    against padding-oracle attacks. Each encrypt call derives a fresh  │
 │    random 96-bit nonce — reuse would be catastrophic for GCM safety.  │
 │                                                                       │
 │ 2. SHA-256      — Used to hash IPFS CIDs before storing on-chain.    │
 │    Ensures the blockchain only ever contains a fixed-length           │
 │    irreversible fingerprint, never raw PII identifiers.               │
 │                                                                       │
 │ 3. JWT (HS256)  — Signed with the server's secret key. Short expiry  │
 │    (60 min default) with clear role claim to enforce RBAC.            │
 │                                                                       │
 │ 4. bcrypt       — Used to hash passwords. Work factor 12 (≥2024 rec) │
 │                                                                       │
 │ 5. Digital Signatures — Consent grants include a signature from the  │
 │    user's Ethereum private key (client-side). Backend verifies the    │
 │    signature against the stored user wallet address before calling    │
 │    grantConsent() on the blockchain.                                  │
 └───────────────────────────────────────────────────────────────────────┘
"""

import os
import hashlib
import base64
from datetime import datetime, timedelta, timezone
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from jose import JWTError, jwt
from passlib.context import CryptContext
from eth_account import Account
from eth_account.messages import encode_defunct

from app.core.config import get_settings

settings = get_settings()

# ── Password Hashing ─────────────────────────────────────────────────────────
# SECURITY: bcrypt with cost factor 12 is the 2024 OWASP recommendation.
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


# ── AES-256-GCM Encryption ───────────────────────────────────────────────────
def _get_aes_key() -> bytes:
    """
    Derive 32-byte AES key from the hex-encoded env variable.
    SECURITY: The key must be exactly 32 bytes for AES-256.
    In production, replace with AWS KMS / Azure Key Vault / HSM.
    """
    raw = bytes.fromhex(settings.AES_ENCRYPTION_KEY)
    if len(raw) != 32:
        raise ValueError("AES_ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars)")
    return raw


def encrypt_document(plaintext: bytes) -> tuple[bytes, bytes]:
    """
    Encrypt document bytes using AES-256-GCM.

    SECURITY: A new 96-bit nonce is generated per encryption call via os.urandom.
    GCM authentication tag (16 bytes) is appended by the AESGCM class.
    The nonce is prepended to the ciphertext and must be stored alongside it.

    Returns:
        (nonce, ciphertext_with_tag)
    """
    key = _get_aes_key()
    nonce = os.urandom(12)          # 96-bit nonce — NEVER reuse with same key
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return nonce, ciphertext


def decrypt_document(nonce: bytes, ciphertext: bytes) -> bytes:
    """
    Decrypt AES-256-GCM ciphertext.
    Raises InvalidTag if the ciphertext was tampered with (integrity check).
    """
    key = _get_aes_key()
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, None)


def encrypt_to_b64(plaintext: bytes) -> str:
    """
    Convenience: encrypt and return base64(nonce || ciphertext).
    The nonce is the first 12 bytes of the decoded blob.
    """
    nonce, ciphertext = encrypt_document(plaintext)
    combined = nonce + ciphertext
    return base64.b64encode(combined).decode()


def decrypt_from_b64(b64_blob: str) -> bytes:
    """
    Convenience: base64-decode, split nonce (first 12 bytes) and decrypt.
    """
    combined = base64.b64decode(b64_blob)
    nonce, ciphertext = combined[:12], combined[12:]
    return decrypt_document(nonce, ciphertext)


# ── SHA-256 Hashing ──────────────────────────────────────────────────────────
def sha256_hex(data: str | bytes) -> str:
    """
    SHA-256 hash of data.
    SECURITY: Used to hash IPFS CIDs before storing on the blockchain.
    Ensures no raw identifiers (PII-adjacent) are ever on-chain.
    """
    if isinstance(data, str):
        data = data.encode()
    return hashlib.sha256(data).hexdigest()


def sha256_bytes32(data: str | bytes) -> bytes:
    """
    Returns SHA-256 hash as bytes32 (for Solidity bytes32 parameter).
    """
    return bytes.fromhex(sha256_hex(data))


# ── JWT Tokens ───────────────────────────────────────────────────────────────
def create_access_token(
    subject: str,
    role: str,
    wallet_address: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a signed JWT.
    SECURITY:
      - role is embedded in the token and validated on every request.
      - wallet_address is included for linking JWT identity to blockchain identity.
      - Short expiry (ACCESS_TOKEN_EXPIRE_MINUTES) limits blast radius of theft.
    """
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": subject,           # User ID (UUID)
        "role": role,             # "user" | "bank" | "validator"
        "wallet": wallet_address, # Ethereum address (optional)
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Decode and validate JWT. Raises JWTError on invalid/expired token.
    """
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )


# ── Ethereum Signature Verification ──────────────────────────────────────────
def verify_eth_signature(message: str, signature: str, expected_address: str) -> bool:
    """
    Verify that `signature` was produced by the private key belonging to `expected_address`.

    SECURITY (Zero-Trust Consent):
    Before calling grantConsent() on the blockchain, the backend verifies
    that the user actually signed the consent message with their private key.
    This prevents a stolen JWT from being used to grant consent without
    the user's cryptographic involvement.

    The private key NEVER leaves the client — we only verify the signature.

    Args:
        message:          The plain-text message that was signed (e.g. consent payload)
        signature:        Hex-encoded signature from the client wallet (MetaMask / ethers.js)
        expected_address: The Ethereum address we expect to have signed

    Returns:
        True if the signature is valid and was made by expected_address.
    """
    try:
        msg = encode_defunct(text=message)
        recovered = Account.recover_message(msg, signature=signature)
        return recovered.lower() == expected_address.lower()
    except Exception:
        return False
