"""
app/core/config.py
──────────────────
Centralised settings loaded from environment variables / .env file.
Pydantic BaseSettings ensures type-safety and validation on startup.
Never hard-code secrets — everything sensitive comes through env vars.
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    # ── Application ──────────────────────────────────────────────────────────
    APP_NAME: str = "Decentralized KYC"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000", 
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173"
    ]

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./kyc.db"       # Swap to postgres:// in prod

    # ── Security: JWT ────────────────────────────────────────────────────────
    # SECURITY: Use a 256-bit random secret. Never commit this value.
    # Generate: python -c "import secrets; print(secrets.token_hex(32))"
    JWT_SECRET_KEY: str = Field(..., env="JWT_SECRET_KEY")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ── Security: AES-256 ────────────────────────────────────────────────────
    # SECURITY: 32-byte key for AES-256. Must be securely rotated in prod.
    # Generate: python -c "import secrets; print(secrets.token_hex(32))"
    AES_ENCRYPTION_KEY: str = Field(..., env="AES_ENCRYPTION_KEY")

    # ── Blockchain ───────────────────────────────────────────────────────────
    BLOCKCHAIN_RPC_URL: str = "http://localhost:8545"
    KYC_CONTRACT_ADDRESS: str = ""           # Filled after deploy
    DEPLOYER_PRIVATE_KEY: str = Field(default="", env="DEPLOYER_PRIVATE_KEY")
    # SECURITY: The deployer key is used only for contract calls (not user keys).
    # User private keys NEVER touch the server.

    # ── IPFS ─────────────────────────────────────────────────────────────────
    IPFS_API_URL: str = "http://localhost:5001"   # Local Kubo IPFS node
    # Optional: INFURA_IPFS_URL + INFURA_PROJECT_ID / SECRET for cloud IPFS

    # ── KYC Business Rules ───────────────────────────────────────────────────
    KYC_DEFAULT_VALIDITY_DAYS: int = 365     # 1-year KYC before re-verification
    MAX_DOCUMENT_SIZE_MB: int = 10

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Cache settings so env is read once."""
    return Settings()
