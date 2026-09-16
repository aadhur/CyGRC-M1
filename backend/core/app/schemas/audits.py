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


class AuditControlReviewResponse(BaseModel):
    id: UUID
    audit_id: UUID
    control_id: UUID
    verdict: ReviewVerdictEnum
    notes: str | None = None
    reviewed_by: UUID
    created_at: datetime
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


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
