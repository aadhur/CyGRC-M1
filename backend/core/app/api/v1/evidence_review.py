# POST /v1/evidence/{id}/review — allows a Compliance Manager or Auditor to
# approve or reject an evidence artefact.
#
# TEMPORARY FILE (B5 — evidence-review squad):
# This is a standalone implementation. It will be merged into the final
# evidence.py during integration. To keep this file self-contained:
#   - The Evidence ORM stub is declared inline (maps to the real `evidence`
#     table created by migration 0002 on the b2-Schema-base-RLS branch).
#   - Auth is handled by a local `get_current_user` dependency; once the
#     shared auth.py middleware lands, replace its body with a single import.
#
# Fields updated on review:
#   review_status  <- payload value ("approved" | "rejected")
#   reviewer       <- authenticated user UUID from session state
#   reviewed_at    <- clock_timestamp() evaluated server-side by PostgreSQL
#
# All other evidence columns are left unchanged.

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from app.db.session import get_db
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import DateTime, String, text, update
from sqlalchemy import func as sa_func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

router = APIRouter()

# -- Inline Evidence ORM stub -----------------------------------------------
# Maps to the `evidence` table defined in migration 0002 (b2-Schema-base-RLS).
# Only the columns required for the review operation are declared here.
# The full model (with all columns and relationships) lives in
# app/db/models.py on the b2-Schema-base-RLS branch.
# REMOVE THIS STUB when integrating into the final evidence.py.


class _StubBase(DeclarativeBase):
    pass


class Evidence(_StubBase):
    """Minimal stub — only columns touched by the review endpoint."""

    __tablename__ = "evidence"
    # Allows smooth coexistence if the real model is imported at integration time.
    __table_args__ = {"extend_existing": True}

    evidence_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
    )
    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        nullable=False,
    )
    review_status: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    reviewer: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        nullable=True,
    )
    reviewed_at: Mapped[object | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


# -- Auth dependency --------------------------------------------------------
# Self-contained for this temporary file.
# Supports two paths:
#   Path A  — Real Keycloak JWT via Authorization: Bearer <token>
#             The auth middleware (auth.py) decodes the JWT and populates
#             request.state.tenant_id and request.state.user_id.
#   Path B  — Local developer bypass via explicit request headers:
#             X-Test-Tenant-ID: <uuid>
#             X-Test-User-ID:   <uuid>
#
# INTEGRATION NOTE: When auth.py is merged, replace `get_current_user` with:
#   from app.middleware.auth import get_current_user

_bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    user_id: UUID
    tenant_id: UUID


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),  # noqa: B008
    x_test_tenant_id: str | None = Header(default=None),
    x_test_user_id: str | None = Header(default=None),
) -> CurrentUser:
    """
    Resolve the authenticated caller.

    Priority:
    1. Path B: X-Test-Tenant-ID + X-Test-User-ID headers (local dev bypass).
    2. Path A: JWT decoded by auth middleware -> request.state fields.
    3. Raise HTTP 401 when no valid identity can be established.
    """
    # Path B: local developer bypass
    if x_test_tenant_id and x_test_user_id:
        try:
            return CurrentUser(
                user_id=UUID(x_test_user_id),
                tenant_id=UUID(x_test_tenant_id),
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="X-Test-Tenant-ID or X-Test-User-ID is not a valid UUID.",
            ) from exc

    # Path A: JWT already decoded by auth middleware -> request.state
    tenant_id_raw = getattr(request.state, "tenant_id", None)
    user_id_raw = getattr(request.state, "user_id", None)
    if tenant_id_raw and user_id_raw:
        try:
            return CurrentUser(
                user_id=UUID(str(user_id_raw)),
                tenant_id=UUID(str(tenant_id_raw)),
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Auth middleware produced an invalid identity.",
            ) from exc

    # No valid identity found
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=(
            "Authentication required. Supply a Bearer token (Authorization header) "
            "or use X-Test-Tenant-ID / X-Test-User-ID headers for local development."
        ),
        headers={"WWW-Authenticate": "Bearer"},
    )


# -- Pydantic schemas -------------------------------------------------------


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
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
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
    current_user: CurrentUser = Depends(get_current_user),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
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

    async with db as session:
        # 2. Activate RLS: set app.tenant_id for this transaction.
        # SET LOCAL scopes the setting to the current transaction only;
        # it resets automatically when the transaction ends.
        await session.execute(
            text("SET LOCAL app.tenant_id = :tid"),
            {"tid": str(current_user.tenant_id)},
        )

        # 3. Verify the evidence record exists and belongs to this tenant.
        # The explicit tenant_id filter enforces isolation at the application
        # layer regardless of whether the RLS migration has been applied yet.
        result = await session.execute(
            select(Evidence).where(
                Evidence.evidence_id == id,
                Evidence.tenant_id == current_user.tenant_id,
            )
        )
        evidence = result.scalar_one_or_none()

        if evidence is None:
            # Return 404 for both "not found" and "wrong tenant" to avoid
            # leaking evidence existence across tenant boundaries.
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Evidence item with id '{id}' not found.",
            )

        # 4. Targeted UPDATE — only the three review columns.
        # reviewed_at uses PostgreSQL clock_timestamp() so the timestamp
        # reflects the exact physical execution time of this statement,
        # not the transaction start time (which now()/CURRENT_TIMESTAMP give).
        await session.execute(
            update(Evidence)
            .where(
                Evidence.evidence_id == id,
                Evidence.tenant_id == current_user.tenant_id,
            )
            .values(
                review_status=review_status,
                reviewer=current_user.user_id,
                reviewed_at=sa_func.clock_timestamp(),
            )
        )
        await session.commit()

    # 5. Return confirmation
    return ReviewResponse(
        message=f"Evidence item with the id {id} reviewed",
    )
