from typing import Annotated

from app.db.models import AuditLog
from app.db.session import get_db
from app.schemas.audit_log import AuditLogResponse
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

security = HTTPBearer()
credentials_dependency = Depends(security)


@router.get("", response_model=AuditLogResponse)
@router.get("/", response_model=AuditLogResponse, include_in_schema=False)
async def get_audit_logs(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    credentials=credentials_dependency,
):
    scopes = getattr(request.state, "scopes", []) or []

    if "auditlog:read" not in scopes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing required scope: auditlog:read",
        )

    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    records = (await db.execute(stmt)).scalars().all()

    return {
        "audit_logs": [
            {
                "log_id": str(record.log_id),
                "actor_id": (
                    str(record.actor_id) if record.actor_id is not None else None
                ),
                "action": record.action,
                "target": record.target,
                "request_id": record.request_id,
                "ip_address": record.ip_address,
                "user_agent": record.user_agent,
                "created_at": record.created_at,
            }
            for record in records
        ]
    }
