# backend/core/app/schemas/controls_patch_evidence_schemas_draft.py
# Author: Vikram Singh
# Issue: #B4.1
# Task: Pydantic schemas for PATCH /v1/controls/{id}
#       and GET /v1/controls/{id}/evidence

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

# ═══════════════════════════════════════════
# PATCH /v1/controls/{control_id}
# ═══════════════════════════════════════════


# Request — what user sends
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


# Response — what user gets back
class ControlPatchResponse(BaseModel):
    message: str

    model_config = {
        "json_schema_extra": {
            "example": {
                "message": "Control 0191a38a-0000-0000-0000-000000000010 successfully updated"
            }
        }
    }


# ═══════════════════════════════════════════
# GET /v1/controls/{control_id}/evidence
# ═══════════════════════════════════════════


# Single evidence item shape
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


# Full response — control_id + evidence list
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
