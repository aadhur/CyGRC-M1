from datetime import datetime
from uuid import UUID

from app.db.models import AuditVerdictEnum
from app.schemas.controls import ControlResponse
from pydantic import BaseModel, Field


class AuditSchema(BaseModel):
    framework_id: UUID
    period_start: datetime
    period_end: datetime
    control_ids: list[UUID] = Field(default_factory=list)


class AuditSignOffSchema(BaseModel):
    signed_off_by: UUID | None = None


class AuditResponseSchema(BaseModel):
    audit_id: UUID
    status: str
    scoped_control_count: int


class AuditControlReviewResponse(BaseModel):
    verdict: AuditVerdictEnum
    reviewed_by: UUID
    reviewed_at: datetime
    notes: str | None = None

    model_config = {"from_attributes": True}


class AuditControlResponse(BaseModel):
    control: ControlResponse
    review: AuditControlReviewResponse | None = None
