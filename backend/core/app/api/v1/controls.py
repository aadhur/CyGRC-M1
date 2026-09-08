from uuid import UUID

from app.api.deps import get_tenant_db
from app.db.models import Control, Evidence
from app.schemas.controls import (
    ControlEvidenceResponse,
    ControlPatchRequest,
    ControlPatchResponse,
    ControlResponse,
    EvidenceItem,
)
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()
http_bearer = HTTPBearer()


@router.get(
    "/v1/controls",
    response_model=list[ControlResponse],
    dependencies=[Depends(http_bearer)],
)
async def list_controls(
    framework_id: UUID | None = Query(None),  # noqa: B008
    db: AsyncSession = Depends(get_tenant_db),  # noqa: B008
    # _scope = Depends(lambda: require_scope("controls:read")),  # wire the actual scope check here
):
    """
    List controls. Optional framework_id filters results.
    RLS must enforce tenant isolation; do NOT filter by tenant_id in Python.
    """
    stmt = select(Control)
    if framework_id:
        stmt = stmt.where(Control.framework_id == framework_id)

    result = await db.execute(stmt)
    controls = result.scalars().all()
    return controls


@router.get(
    "/v1/controls/{control_id}",
    response_model=ControlResponse,
    dependencies=[Depends(http_bearer)],
)
async def get_control(
    control_id: UUID,
    db: AsyncSession = Depends(get_tenant_db),  # noqa: B008
    # _scope = Depends(lambda: require_scope("controls:read")),  # wire the actual scope check here
):
    """
    Fetch a single control by id. Returns 404 if not found (including cross-tenant).
    """
    stmt = select(Control).where(Control.control_id == control_id)
    result = await db.execute(stmt)
    control = result.scalar_one_or_none()
    if control is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Control not found."
        )
    return control


@router.patch(
    "/v1/controls/{control_id}",
    response_model=ControlPatchResponse,
    dependencies=[Depends(http_bearer)],
)
async def patch_control(
    control_id: UUID,
    payload: ControlPatchRequest,
    db: AsyncSession = Depends(get_tenant_db),  # noqa: B008
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
    db: AsyncSession = Depends(get_tenant_db),  # noqa: B008
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
