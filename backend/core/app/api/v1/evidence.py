import os
from datetime import datetime, timezone
from uuid import UUID

from app.db.models import Control, Evidence, EvidenceRequirement
from app.db.session import get_db
from app.services.storage import upload_evidence as upload_evidence_to_storage
from app.utils.crypto import calculate_sha256
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from fastapi.security import HTTPBearer
from pydantic import BaseModel
from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func as sa_func
from uuid6 import uuid7

router = APIRouter()

# RLS session variable name (see assumption #2)
_RLS_TENANT_SETTING = "app.tenant_id"

# Marks placeholder rows created by the local-only fallback (assumption #4)
_MOCK_REQUIREMENT_TYPE = "mock"


async def _get_tenant_and_user(request: Request) -> tuple[UUID, UUID]:
    tenant_id = getattr(request.state, "tenant_id", None)
    user_id = getattr(request.state, "user_id", None)

    if not tenant_id or not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication context.",
        )

    return tenant_id, user_id


def _is_local_env() -> bool:
    try:
        from core import settings  # see assumption #3

        return settings.ENVIRONMENT == "local"
    except ImportError:
        # Degrade sanely if settings lives elsewhere — fix the import
        # above instead of relying on this branch.
        return os.getenv("ENVIRONMENT", "production") == "local"


def _infer_artefact_type(filename: str, content_type: str | None) -> str:
    """See assumption #5 — placeholder classification only."""
    _, ext = os.path.splitext(filename)
    ext = ext.lstrip(".").lower()
    if ext:
        return ext
    if content_type:
        return content_type
    return "unknown"


# ── Pydantic schemas ──────────────────────────────────────────────────────
class EvidenceUploadResponse(BaseModel):
    evidence_id: UUID
    message: str


# ── Route ─────────────────────────────────────────────────────────────────


@router.post(
    "/v1/evidence",
    response_model=EvidenceUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_evidence(
    control_id: UUID = Form(...),  # noqa: B008
    requirement_id: UUID = Form(...),  # noqa: B008
    file: UploadFile = File(...),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(_get_tenant_and_user),
    _credentials=Depends(HTTPBearer()),  # noqa: B008
):
    tenant_id, _user_id = tenant_user

    # Scope this DB session to the caller's tenant so RLS enforces
    # isolation at the database layer, not just via an app-level filter.
    await db.execute(
        text(f"SET LOCAL {_RLS_TENANT_SETTING} = :tenant_id"),
        {"tenant_id": str(tenant_id)},
    )

    # Fail fast, before touching storage: confirm control_id exists and
    # belongs to this tenant (see "Control tenant-ownership check" note
    # above for why this isn't just left to the FK constraint).
    try:
        control = await db.scalar(
            select(Control).where(
                Control.control_id == control_id,
                Control.tenant_id == tenant_id,
            )
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not look up control: {exc}",
        ) from exc

    if control is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Control '{control_id}' does not exist for this tenant.",
        )

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is missing a filename.",
        )

    try:
        sha256_hash = await calculate_sha256(file)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not hash uploaded file: {exc}",
        ) from exc

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
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Evidence upload to storage failed: {exc}",
        ) from exc

    # Persist evidence metadata. Roll back the database transaction
    # if metadata persistence fails.
    try:
        requirement = await db.scalar(
            select(EvidenceRequirement).where(
                EvidenceRequirement.requirement_id == requirement_id,
                EvidenceRequirement.control_id == control_id,
            )
        )

        if requirement is None:
            if not _is_local_env():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Requirement '{requirement_id}' does not exist for this control.",
                )
            # Requirement seeding engine isn't built yet — auto-create a
            # mock row per B5 so local dev/demo isn't blocked on it.
            # EvidenceRequirement has no tenant_id column; tenant scoping
            # is implicit via control_id, whose ownership was already
            # verified above.
            requirement = EvidenceRequirement(
                requirement_id=requirement_id,
                control_id=control_id,
                type=_MOCK_REQUIREMENT_TYPE,
                description="Auto-created placeholder requirement (local environment fallback).",
            )
            db.add(requirement)
            await db.flush()

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
            review_status="pending",
            # expires_at, reviewer, reviewed_at: left unset — null on creation
        )
        db.add(evidence)
        await db.commit()
        await db.refresh(evidence)

    except HTTPException:
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Evidence metadata could not be saved; upload was rolled back: {exc}",
        ) from exc

    return EvidenceUploadResponse(
        evidence_id=evidence.evidence_id,
        message="Evidence uploaded successfully.",
    )


class ReviewRequest(BaseModel):
    """
    JSON payload for the review decision.
    Accepted values: "approved" or "rejected".
    Any other value raises 422 Unprocessable Entity.
    """

    review_status: str

    def validated_status(self) -> str:
        allowed = {"approved", "rejected"}
        if self.review_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=(
                    f"Invalid review_status '{self.review_status}'. "
                    "Must be 'approved' or 'rejected'."
                ),
            )
        return self.review_status


class ReviewResponse(BaseModel):
    """Response body returned on successful review."""

    message: str


# -- Route ------------------------------------------------------------------


@router.post(
    "/v1/evidence/{id}/review",
    response_model=ReviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Review an evidence item",
    description=(
        "Allows an authenticated Compliance Manager or Auditor to approve or "
        "reject an evidence artefact. Updates review_status, reviewer, and "
        "reviewed_at (set to clock_timestamp() server-side). All other evidence "
        "fields are left unchanged."
    ),
    tags=["Evidence"],
)
async def review_evidence(
    id: UUID,
    payload: ReviewRequest,
    tenant_user: tuple[UUID, UUID] = Depends(_get_tenant_and_user),
    db: AsyncSession = Depends(get_db),  # noqa: B008
    _credentials=Depends(HTTPBearer()),  # noqa: B008
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
    tenant_id, user_id = tenant_user

    await db.execute(
        text("SET LOCAL app.tenant_id = :tid"),
        {"tid": str(tenant_id)},
    )

    result = await db.execute(
        select(Evidence).where(
            Evidence.evidence_id == id,
            Evidence.tenant_id == tenant_id,
        )
    )

    evidence = result.scalar_one_or_none()

    if evidence is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence item with id '{id}' not found.",
        )

    await db.execute(
        update(Evidence)
        .where(
            Evidence.evidence_id == id,
            Evidence.tenant_id == tenant_id,
        )
        .values(
            review_status=review_status,
            reviewer=user_id,
            reviewed_at=sa_func.clock_timestamp(),
        )
    )

    await db.commit()

    # 5. Return confirmation
    return ReviewResponse(
        message=f"Evidence item with the id {id} reviewed",
    )
