import logging
import os
from datetime import datetime, timezone
from uuid import UUID

from app.api.deps import get_tenant_and_user, require_scope
from app.db.models import Control, Evidence, EvidenceRequirement, ReviewStatus
from app.db.session import get_db
from app.schemas.evidence import EvidenceUploadResponse, ReviewRequest, ReviewResponse
from app.services.storage import cleanup_evidence_storage
from app.services.storage import upload_evidence as upload_evidence_to_storage
from app.utils.crypto import calculate_sha256
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.security import HTTPBearer
from sqlalchemy import select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func as sa_func
from uuid6 import uuid7

router = APIRouter()
logger = logging.getLogger(__name__)


def _infer_artefact_type(filename: str, content_type: str | None) -> str:
    _, ext = os.path.splitext(filename)
    ext = ext.lstrip(".").lower()
    return ext or content_type or "unknown"


# ── Route ─────────────────────────────────────────────────────────────────


@router.post(
    "",
    response_model=EvidenceUploadResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(HTTPBearer()),
        Depends(require_scope("evidence:write")),
    ],
)
async def upload_evidence(
    control_id: UUID = Form(...),  # noqa: B008
    requirement_id: UUID = Form(...),  # noqa: B008
    file: UploadFile = File(...),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(get_tenant_and_user),
):
    tenant_id, _ = tenant_user

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is missing a filename.",
        )

        # Confirm requirement exists for this control.
        # PostgreSQL RLS enforces tenant isolation.
    control = await db.scalar(
        select(Control).where(
            Control.control_id == control_id,
        )
    )
    if control is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Control '{control_id}' does not exist for this tenant.",
        )

    # Confirm requirement exists for this control.
    requirement = await db.scalar(
        select(EvidenceRequirement).where(
            EvidenceRequirement.requirement_id == requirement_id,
            EvidenceRequirement.control_id == control_id,
        )
    )
    if requirement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence requirement '{requirement_id}' does not exist for this control.",
        )

    try:
        sha256_hash = await calculate_sha256(file)
    except (OSError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not hash uploaded file",
        )

    evidence_id = uuid7()

    _, extension = os.path.splitext(file.filename)
    extension = extension.lstrip(".").lower() or "bin"

    try:
        blob_s3_key = upload_evidence_to_storage(
            file.file,
            tenant_id,
            evidence_id,
            extension,
        )
    except (OSError, ValueError, TypeError) as exc:
        logger.exception(
            "Evidence upload to storage failed",
            extra={
                "tenant_id": str(tenant_id),
                "evidence_id": str(evidence_id),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Evidence upload to storage failed.",
        ) from exc

    # Persist evidence metadata. Roll back the database transaction
    # if metadata persistence fails.
    try:
        evidence = Evidence(
            evidence_id=evidence_id,
            tenant_id=tenant_id,
            control_id=control_id,
            requirement_id=requirement.requirement_id,
            sha256=sha256_hash,
            blob_s3_key=blob_s3_key,
            collected_at=datetime.now(timezone.utc),
            connector="manual",
            source_ref=file.filename,
            artefact_type=_infer_artefact_type(file.filename, file.content_type),
            review_status=ReviewStatus.PENDING,
            # expires_at, reviewer, reviewed_at: left unset — null on creation
        )
        db.add(evidence)
        await db.commit()

    except (OSError, ValueError, TypeError) as exc:
        await db.rollback()
        cleanup_evidence_storage(
            blob_s3_key,
            tenant_id,
            evidence_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Evidence could not be saved.",
        ) from exc

    return EvidenceUploadResponse(
        evidence_id=evidence.evidence_id,
        message="Evidence uploaded successfully.",
    )


@router.post(
    "/{evidence_id}/review",
    response_model=ReviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Review an evidence item",
    description=(
        "Allows an authenticated Compliance Manager or Auditor to approve or "
        "reject an evidence artefact. Updates review_status, reviewer, and "
        "reviewed_at (set to clock_timestamp() server-side). All other evidence "
        "fields are left unchanged."
    ),
    dependencies=[
        Depends(HTTPBearer()),
        Depends(require_scope("evidence:review")),
    ],
)
async def review_evidence(
    evidence_id: UUID,
    payload: ReviewRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(get_tenant_and_user),
) -> ReviewResponse:
    """
    POST /v1/evidence/{id}/review

    Steps:
    1. Validate review_status is approved or rejected.
    2. Activate PostgreSQL RLS for the authenticated tenant (SET LOCAL).
    3. Fetch the evidence record, verifying it exists and belongs to the tenant.
    4. Execute a targeted UPDATE: review_status, reviewer, reviewed_at.
    5. Return a confirmation message.
    """
    # 1. Validate review_status
    review_status = payload.validated_status()
    _, user_id = tenant_user

    evidence = await db.scalar(
        select(Evidence).where(
            Evidence.evidence_id == evidence_id,
        )
    )
    if evidence is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence item with id '{evidence_id}' not found.",
        )
    try:
        await db.execute(
            update(Evidence)
            .where(
                Evidence.evidence_id == evidence_id,
            )
            .values(
                review_status=review_status,
                reviewer=user_id,
                reviewed_at=sa_func.clock_timestamp(),
            )
        )
        await db.commit()
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Evidence could not be reviewed.",
        ) from exc

    # 5. Return confirmation
    return ReviewResponse(
        message=f"Evidence item with the id {evidence_id} reviewed",
    )
