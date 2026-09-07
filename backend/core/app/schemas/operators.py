from datetime import datetime
from uuid import UUID

from app.db.models import TenantStatus
from pydantic import BaseModel


class TenantListItem(BaseModel):
    tenant_id: UUID
    name: str
    status: TenantStatus
    plan: str
    created_at: datetime

    class Config:
        from_attributes = True


class TenantListResponse(BaseModel):
    tenants: list[TenantListItem]
