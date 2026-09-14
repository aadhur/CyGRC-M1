from datetime import datetime
from uuid import UUID

from app.db.models import TenantStatus
from pydantic import BaseModel, Field


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


class BreakGlassRequestSchema(BaseModel):
    target_tenant_id: UUID = Field(..., description="The tenant needing support")
    # "INC-90145", "SR-4421", "PROJ-123" etc: letters, a dash, 3-10 digits.
    ticket_ref: str = Field(..., pattern=r"^[A-Z]+-[0-9]{3,10}$")
    reason: str = Field(..., min_length=10, max_length=500)
    duration_hours: int = Field(default=2, ge=1, le=8)


class BreakGlassApproveResponse(BaseModel):
    session_id: UUID
    status: str
    expires_at: datetime


class BreakGlassRevokeSchema(BaseModel):
    reason: str = Field(..., min_length=5, max_length=500)
