from datetime import datetime
from uuid import UUID

from app.db.models import AIDraftStatus
from pydantic import BaseModel, ConfigDict, model_validator


class DraftRequest(BaseModel):
    control_id: UUID | None = None
    risk_id: UUID | None = None

    @model_validator(mode="after")
    def validate_target(self):
        if (self.control_id is None) == (self.risk_id is None):
            raise ValueError("Exactly one of control_id or risk_id must be provided.")
        return self


class DraftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    draft_id: UUID
    review_token: str
    output: str
    model: str


class AIDraftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    draft_id: UUID
    control_id: UUID | None
    risk_id: UUID | None
    output: str
    model: str
    status: AIDraftStatus
    requested_by: UUID
    reviewed_by: UUID | None
    created_at: datetime
    reviewed_at: datetime | None


class ApproveRequest(BaseModel):
    edited_output: str
