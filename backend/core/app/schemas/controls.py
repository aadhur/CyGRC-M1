from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ControlResponse(BaseModel):
    control_id: UUID
    framework_id: UUID
    code: str
    title: str
    description: str
    owner: UUID
    status: str
    notes: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ControlPatchRequest(BaseModel):
    owner: UUID | None = None
    notes: str | None = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "owner": "0191a38a-9999-9999-9999-999999999999",
                "notes": "MFA is verified via Azure AD conditional access policies.",
            }
        }
    }


class ControlPatchResponse(BaseModel):
    message: str

    model_config = {
        "json_schema_extra": {
            "example": {
                "message": "Control 0191a38a-0000-0000-0000-000000000010 successfully updated"
            }
        }
    }


class EvidenceItem(BaseModel):
    evidence_id: UUID
    requirement_id: UUID | None = None
    source_ref: str | None = None
    connector: str | None = None
    sha256: str | None = None
    review_status: str | None = None
    collected_at: datetime | None = None

    model_config = {
        "from_attributes": True  # allows building from SQLAlchemy objects
    }


class ControlEvidenceResponse(BaseModel):
    control_id: UUID
    evidence: list[EvidenceItem]

    model_config = {
        "json_schema_extra": {
            "example": {
                "control_id": "0191a38a-0000-0000-0000-000000000010",
                "evidence": [
                    {
                        "evidence_id": "0191a38a-8888-8888-8888-888888888888",
                        "requirement_id": "0191a38a-7777-7777-7777-777777777777",
                        "source_ref": "firewall_rules.pdf",
                        "connector": "manual",
                        "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                        "review_status": "pending",
                        "collected_at": "2026-09-02T10:00:00Z",
                    }
                ],
            }
        }
    }


class ControlCalculateRequest(BaseModel):
    control_id: UUID | None = None

    model_config = {
        "json_schema_extra": {
            "example": {"control_id": "0191a38a-0000-0000-0000-000000000010"}
        }
    }
