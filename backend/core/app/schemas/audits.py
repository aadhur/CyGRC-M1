from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ReviewVerdictEnum(str, Enum):
    PASS = "Pass"
    FAIL = "Fail"
    EXCEPTION = "Exception"


class AuditControlReviewCreate(BaseModel):
    verdict: ReviewVerdictEnum
    notes: str | None = None


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
    created_at: datetime
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AuditSignOffResponse(BaseModel):
    audit_id: UUID
    status: str = "Closed"
    signed_off_by: UUID
    signed_off_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


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
