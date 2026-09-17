from datetime import date, datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AuditStatusEnum(str, Enum):
    PLANNING = "planning"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    CLOSED = "closed"


class ReviewVerdictEnum(str, Enum):
    PASS = "Pass"
    FAIL = "Fail"
    EXCEPTION = "Exception"


class FindingSeverityEnum(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class FindingStatusEnum(str, Enum):
    OPEN = "Open"
    IN_PROGRESS = "In Progress"
    RESOLVED = "Resolved"
    CLOSED = "Closed"


# --- Cycle & Scope Schemas ---
class AuditSchema(BaseModel):
    framework_id: UUID
    period_start: date | datetime
    period_end: date | datetime
    control_ids: list[UUID] | None = None


class AuditResponseSchema(BaseModel):
    audit_id: UUID
    status: AuditStatusEnum | str
    scoped_control_count: int = 0
    model_config = ConfigDict(from_attributes=True)


class AuditControlResponse(BaseModel):
    control: Any
    review: Any | None = None
    model_config = ConfigDict(from_attributes=True)


# --- Control Review, Finding & Sign-Off Schemas ---
class AuditControlReviewCreate(BaseModel):
    verdict: ReviewVerdictEnum
    notes: str | None = None


class AuditControlReviewResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    audit_id: UUID
    control_id: UUID
    verdict: ReviewVerdictEnum
    notes: str | None = None
    reviewed_by: UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
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
    id: UUID
    audit_id: UUID
    control_id: UUID
    severity: FindingSeverityEnum
    description: str
    recommendation: str
    owner: UUID
    due_date: datetime
    status: FindingStatusEnum
    created_at: datetime | None = None
    updated_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class AuditSignOffResponse(BaseModel):
    audit_id: UUID
    status: str = "Closed"
    signed_off_by: UUID
    signed_off_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)
