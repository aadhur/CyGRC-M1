# backend/core/app/api/v1/controls_patch_evidence_draft.py
# Author: Vikram Singh
# Issue: #B4.1
# Task: PATCH /v1/controls/{control_id}
#       GET  /v1/controls/{control_id}/evidence

from uuid import UUID

from app.db.evidence_models import Evidence
from app.db.models import Control
from app.db.session import get_db
from app.schemas.controls_patch_evidence_schemas_draft import (
    ControlEvidenceResponse,
    ControlPatchRequest,
    ControlPatchResponse,
    EvidenceItem,
)
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()
# FastAPI security dependency to enable Swagger UI token injection
http_bearer = HTTPBearer()

# NOTE: Replace these placeholder imports with the real tenant-context and scope-check
# dependencies implemented in #B4.1.1. Do NOT add manual tenant filtering (RLS handles isolation).
# from app.api.dependencies import tenant_context, require_scope
# tenant_ctx: TenantContext = Depends(tenant_context)
# _ = Depends(require_scope("controls:read"))


@router.patch(
    "/v1/controls/{control_id}",
    response_model=ControlPatchResponse,
    dependencies=[Depends(http_bearer)],
)
async def patch_control(
    control_id: UUID,
    payload: ControlPatchRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    # tenant_ctx = Depends(tenant_context),  # wire the actual tenant dependency here
    # _scope = Depends(lambda: require_scope("controls:read")),  # wire the actual scope check here
):
    """
    Update editable metadata (owner/notes) of a specific control.
    RLS must enforce tenant isolation; do NOT filter by tenant_id in Python.
    Returns 404 if not found (including cross-tenant).
    """
    stmt = select(Control).where(Control.control_id == control_id)
    result = await db.execute(stmt)
    control = result.scalar_one_or_none()

    if control is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Control not found."
        )

    # Only update fields explicitly provided in the request
    if payload.owner is not None:
        control.owner = payload.owner

    if payload.notes is not None:
        control.notes = payload.notes

    await db.commit()

    return ControlPatchResponse(message=f"Control {control_id} successfully updated")


@router.get(
    "/v1/controls/{control_id}/evidence",
    response_model=ControlEvidenceResponse,
    dependencies=[Depends(http_bearer)],
)
async def get_control_evidence(
    control_id: UUID,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    # tenant_ctx = Depends(tenant_context),  # wire the actual tenant dependency here
    # _scope = Depends(lambda: require_scope("evidence:write")),  # wire the actual scope check here
):
    """
    List all evidence records linked to a specific control.
    Returns 200 OK with empty array [] if no evidence found.
    RLS must enforce tenant isolation; do NOT filter by tenant_id in Python.
    Returns 404 if control not found (including cross-tenant).
    """
    # First check the control exists (RLS will filter cross-tenant)
    control_stmt = select(Control).where(Control.control_id == control_id)
    control_result = await db.execute(control_stmt)
    control = control_result.scalar_one_or_none()

    if control is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Control not found."
        )

    # Fetch evidence — RLS auto-filters by tenant
    evidence_stmt = select(Evidence).where(Evidence.control_id == control_id)
    evidence_result = await db.execute(evidence_stmt)
    evidence_rows = evidence_result.scalars().all()

    return ControlEvidenceResponse(
        control_id=control_id,
        evidence=[EvidenceItem.model_validate(e) for e in evidence_rows],
    )
