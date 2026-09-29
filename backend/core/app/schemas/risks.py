from datetime import datetime
from uuid import UUID

from app.db.models import RiskStatusEnum, RiskTreatmentEnum
from pydantic import BaseModel, Field


class PostRiskRequest(BaseModel):
    title: str
    description: str | None = None
    likelihood: int = Field(ge=1, le=5)
    impact: int = Field(ge=1, le=5)
    treatment: RiskTreatmentEnum | None = None
    treatment_plan: str | None = None
    target_close_date: datetime | None = None
    control_ids: list[UUID] = Field(default_factory=list)
    model_config = {
        "json_schema_extra": {
            "example": {
                "title": "Misconfigured public S3 bucket",
                "description": "S3 bucket is publicly accessible due to an incorrect bucket policy.",
                "likelihood": 4,
                "impact": 5,
                "treatment": "MITIGATE",
                "treatment_plan": "Enforce bucket policies via AWS Config rule.",
                "target_close_date": "2026-12-01T00:00:00Z",
                "control_ids": [
                    "550e8400-e29b-41d4-a716-446655440000",
                    "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
                ],
            }
        }
    }


class PostRiskResponse(BaseModel):
    risk_id: UUID
    msg: str


class GetRiskResponse(BaseModel):
    title: str
    risk_id: UUID
    description: str | None = None
    likelihood: int = Field(ge=1, le=5)
    impact: int = Field(ge=1, le=5)
    inherent_score: int = Field(ge=1, le=25)
    residual_score: int | None = None
    treatment: RiskTreatmentEnum | None = None
    treatment_plan: str | None = None
    target_close_date: datetime | None = None
    status: RiskStatusEnum
    control_ids: list[UUID] = Field(default_factory=list)


GetListRiskResponse = list[GetRiskResponse]


class RiskPatchRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    likelihood: int | None = None
    impact: int | None = None
    treatment: RiskTreatmentEnum | None = None
    treatment_plan: str | None = None
    target_close_date: datetime | None = None
    status: RiskStatusEnum | None = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "treatment_plan": "Rotate access keys quarterly.",
                "status": "OPEN",
            }
        }
    }


class RiskPatchResponse(BaseModel):
    risk_id: UUID
    message: str


class RiskCloseRequest(BaseModel):
    status: RiskStatusEnum  # "CLOSED" or "ACCEPTED"


class RiskCloseResponse(BaseModel):
    risk_id: UUID
    status: RiskStatusEnum
    message: str
