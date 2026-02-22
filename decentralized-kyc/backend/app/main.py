"""
app/main.py
────────────
FastAPI application entry point.
- Registers all routers
- Applies CORS, middleware, and lifespan events
- Sets up database on startup
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.core.config import get_settings
from app.core.blockchain import blockchain_client
from app.db.database import create_tables, SessionLocal
from app.db.seeds import seed_data

# ── Routers ───────────────────────────────────────────────────────────────────
from app.api.auth import router as auth_router
from app.api.kyc import router as kyc_router
from app.api.consent import router as consent_router
from app.api.audit import router as audit_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup & shutdown lifecycle events."""
    # ── Startup ───────────────────────────────────────────────────────────────
    print(f"[Startup] {settings.APP_NAME} v{settings.APP_VERSION}")
    create_tables()
    print("[Startup] Database tables ready")
    
    # ── Seed Data ─────────────────────────────────────────────────────────────
    with SessionLocal() as db:
        seed_data(db)

    if blockchain_client.is_connected():
        print(f"[Startup] Blockchain connected: {settings.BLOCKCHAIN_RPC_URL}")
    else:
        print("[Startup] WARNING: Blockchain not connected — chain features degraded")

    yield

    # ── Shutdown ──────────────────────────────────────────────────────────────
    print("[Shutdown] Cleaning up resources...")


# ── Application ───────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
## Decentralized KYC System API

A production-grade, blockchain-anchored Know Your Customer platform.

### Key Security Features
- **AES-256-GCM** encryption for all stored documents
- **SHA-256** hashing before on-chain storage (no PII on blockchain)
- **JWT + RBAC** role-based access control
- **ECDSA signature verification** for zero-trust consent
- **Immutable audit trail** (chain events + DB log)

### Roles
| Role | Permissions |
|------|-------------|
| `user` | Upload KYC, grant/revoke consent, view own logs |
| `bank` | Request access, view granted KYC status, view own audit logs |
| `validator` | Verify KYC records, view all audit logs |
""",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
_cors_origins = settings.ALLOWED_ORIGINS.copy()
if settings.EXTRA_ORIGINS:
    _cors_origins += [o.strip() for o in settings.EXTRA_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.CORS_ALLOW_ALL else _cors_origins,
    allow_credentials=not settings.CORS_ALLOW_ALL,   # credentials not allowed with wildcard
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# ── Trusted Host (prevents Host header injection) ─────────────────────────────
# SECURITY: In production, replace with your actual domain.
# app.add_middleware(TrustedHostMiddleware, allowed_hosts=["yourdomain.com"])

# ── Register Routers ─────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(kyc_router)
app.include_router(consent_router)
app.include_router(audit_router)


# ── Validation Error Logging ──────────────────────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Log validation errors (422) for easier debugging."""
    # Convert errors to JSON-safe format (Pydantic v2 may include non-serializable objects)
    safe_errors = []
    for err in exc.errors():
        safe_errors.append({
            "loc": [str(l) for l in err.get("loc", [])],
            "msg": str(err.get("msg", "")),
            "type": str(err.get("type", "")),
        })
    
    print(f"[422 Validation Error] {request.method} {request.url}")
    for err in safe_errors:
        loc = " -> ".join(err["loc"])
        print(f"  - {loc}: {err['msg']}")

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": safe_errors},
    )


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    """System health check — used by Docker and load balancers."""
    return {
        "status": "healthy",
        "blockchain_connected": blockchain_client.is_connected(),
        "version": settings.APP_VERSION,
    }


@app.get("/", tags=["System"])
async def root():
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "docs": "/docs",
        "version": settings.APP_VERSION,
    }
