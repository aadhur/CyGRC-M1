from uuid import UUID

from fastapi import HTTPException, status
from pydantic import BaseModel


class EvidenceUploadResponse(BaseModel):
    evidence_id: UUID
    message: str


class ReviewRequest(BaseModel):
    """
    JSON payload for the review decision.
    Accepted values: "approved" or "rejected".
    Any other value raises 422 Unprocessable Entity.
    """

    review_status: str

    def validated_status(self) -> str:
        allowed = {"APPROVED", "REJECTED"}
        if self.review_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Invalid review_status '{self.review_status}'. "
                    "Must be 'APPROVED' or 'REJECTED'."
                ),
            )
        return self.review_status


class ReviewResponse(BaseModel):
    """Response body returned on successful review."""

    message: str
