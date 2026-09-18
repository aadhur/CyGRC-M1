from datetime import date, datetime
from uuid import UUID

from app.db.models import (
    AuditStatusEnum,
    AuditVerdictEnum,
    FindingSeverityEnum,
    FindingStatusEnum,
)
from app.schemas.controls import ControlResponse
from pydantic import BaseModel, ConfigDict


# --- Cycle & Scope Schemas ---
class AuditSchema(BaseModel):
    framework_id: UUID
    period_start: date | datetime
    period_end: date | datetime
    control_ids: list[UUID] | None = None


class AuditResponseSchema(BaseModel):
    audit_id: UUID
    status: AuditStatusEnum
    scoped_control_count: int = 0
    model_config = ConfigDict(from_attributes=True)


# --- Control Review, Finding & Sign-Off Schemas ---
class AuditControlReviewCreate(BaseModel):
    verdict: AuditVerdictEnum
    notes: str | None = None


class AuditControlReviewResponse(BaseModel):
    tenant_id: UUID
    audit_id: UUID
    control_id: UUID
    verdict: AuditVerdictEnum
    notes: str | None = None
    reviewed_by: UUID | None = None
    reviewed_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class AuditControlResponse(BaseModel):
    control: ControlResponse
    review: AuditControlReviewResponse | None = None
    model_config = ConfigDict(from_attributes=True)


class FindingCreate(BaseModel):
    control_id: UUID
    severity: FindingSeverityEnum
    description: str
    recommendation: str
    owner: UUID
    due_date: datetime


class FindingUpdate(BaseModel):
    status: FindingStatusEnum


class FindingResponse(BaseModel):
    finding_id: UUID
    audit_id: UUID
    control_id: UUID
    severity: FindingSeverityEnum
    description: str
    recommendation: str
    owner: UUID
    due_date: datetime | None = None
    status: FindingStatusEnum
    model_config = ConfigDict(from_attributes=True)


class AuditSignOffResponse(BaseModel):
    audit_id: UUID
    status: AuditStatusEnum
    signed_off_by: UUID
    model_config = ConfigDict(from_attributes=True)
