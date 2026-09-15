from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AuditLogItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    log_id: UUID
    actor_id: UUID | None = None
    action: str
    target: str
    status_code: int
    request_id: UUID
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime


class AuditLogResponse(BaseModel):
    audit_logs: list[AuditLogItem]
