"""
app/api/audit.py
─────────────────
Audit log endpoint.
GET /audit/logs  — paginated audit log (role-filtered)
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.database import get_db, AuditLog, User
from app.middleware.rbac import require_any, require_validator, get_current_user
from app.models.schemas import AuditLogList, AuditLogOut

router = APIRouter(prefix="/audit", tags=["Audit Logs"])


@router.get("/logs", response_model=AuditLogList)
async def get_audit_logs(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, le=200),
    event_type: Optional[str] = Query(default=None),
    current_user: User = Depends(require_any),
    db: Session = Depends(get_db),
):
    """
    Return audit logs.

    RBAC Rules:
    - role=user    → Only sees events where they are actor or target.
    - role=bank    → Only sees access events involving themselves.
    - role=validator → Sees all logs (full audit view).

    COMPLIANCE:
    - This endpoint satisfies RBI's audit trail requirement and GDPR's
      right to access processing records.
    - Log structure includes TX hash for blockchain verification.
    """
    query = db.query(AuditLog)

    if current_user.role.value == "validator":
        # Validators see everything
        pass
    elif current_user.role.value == "bank":
        # Banks only see events where they were the actor
        query = query.filter(AuditLog.actor_id == current_user.id)
    else:
        # Users see events where they are actor or target
        query = query.filter(
            (AuditLog.actor_id == current_user.id) |
            (AuditLog.target_user_id == current_user.id)
        )

    if event_type:
        query = query.filter(AuditLog.event_type == event_type)

    total = query.count()
    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()

    return AuditLogList(
        total=total,
        logs=[AuditLogOut.model_validate(log) for log in logs],
    )
