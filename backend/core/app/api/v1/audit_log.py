from typing import Annotated

from app.api.deps import require_scope
from app.db.models import AuditLog
from app.db.session import get_db
from app.schemas.audit_log import AuditLogResponse
from fastapi import APIRouter, Depends
from fastapi.security import HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

security = HTTPBearer()


@router.get(
    "",
    response_model=AuditLogResponse,
    dependencies=[
        Depends(security),
        Depends(require_scope("auditlog:read")),
    ],
)
async def get_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
):

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
                "status_code": record.status_code,
                "request_id": record.request_id,
                "ip_address": record.ip_address,
                "user_agent": record.user_agent,
                "created_at": record.created_at,
            }
            for record in records
        ]
    }
