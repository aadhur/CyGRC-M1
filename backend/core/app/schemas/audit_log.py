from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AuditLogItem(BaseModel):
    log_id: UUID
    actor_id: UUID | None
    action: str
    target: str | None
    request_id: str | None
    ip_address: str | None
    user_agent: str | None
    created_at: datetime


class AuditLogResponse(BaseModel):
    audit_logs: list[AuditLogItem]
