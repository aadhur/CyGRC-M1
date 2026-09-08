
import os
from datetime import datetime, timezone
from uuid import UUID

import jwt
from app.crypto import sha256_of_bytes
from app.db.models import Control, Evidence, EvidenceRequirement
from app.db.session import get_db
from app.storage import StorageError, delete_file, generate_tenant_key, upload_file
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from uuid6 import uuid7

router = APIRouter()

# ── Auth / JWT config (see assumption #1) ───────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET_KEY", "")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
_bearer_scheme = HTTPBearer()

# RLS session variable name (see assumption #2)
_RLS_TENANT_SETTING = "app.tenant_id"

# Marks placeholder rows created by the local-only fallback (assumption #4)
_MOCK_REQUIREMENT_TYPE = "mock"


async def _get_tenant_and_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> tuple[UUID, UUID]:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        ) from exc

    raw_tenant_id = payload.get("tenant_id")
    raw_user_id = payload.get("sub") or payload.get("user_id")
    if not raw_tenant_id or not raw_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing tenant/user claims.",
        )
    try:
        return UUID(str(raw_tenant_id)), UUID(str(raw_user_id))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tenant/user claims are not valid UUIDs.",
        ) from exc


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
    control_id: UUID = Form(...),
    requirement_id: UUID = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(_get_tenant_and_user),
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
    except Exception as exc:  # noqa: BLE001
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

    # Read + hash. Evidence files are assumed small enough to buffer in
    # memory (screenshots, exported PDFs/logs); if that stops holding,
    # switch to crypto.sha256_of_stream(file.file) + a streaming upload.
    try:
        file_bytes = await file.read()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read uploaded file: {exc}",
        ) from exc

    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    sha256_hash = sha256_of_bytes(file_bytes)
    evidence_id = uuid7()

    # Upload to MinIO under the tenant-isolated key.
    blob_s3_key = generate_tenant_key(tenant_id, evidence_id, file.filename)
    try:
        await upload_file(
            key=blob_s3_key,
            body=file_bytes,
            content_type=file.content_type,
        )
    except StorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Evidence upload to storage failed: {exc}",
        ) from exc

    # Persist metadata. If anything below fails, roll back the DB
    # transaction AND best-effort delete the object we just uploaded, so we
    # never leave an orphaned storage object with no metadata row.
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
        await delete_file(blob_s3_key)
        raise
    except Exception as exc:  # noqa: BLE001
        await db.rollback()
        await delete_file(blob_s3_key)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Evidence metadata could not be saved; upload was rolled back: {exc}",
        ) from exc

    return EvidenceUploadResponse(
        evidence_id=evidence.evidence_id,
        message="Evidence uploaded successfully.",
    )
