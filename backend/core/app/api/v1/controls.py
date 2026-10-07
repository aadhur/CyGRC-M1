from uuid import UUID

from app.api.deps import get_tenant_and_user, require_scope
from app.db.models import Control, Evidence, EvidenceRequirement, User
from app.db.session import get_db
from app.schemas.controls import (
    AssigneeItem,
    ControlCalculateRequest,
    ControlEvidenceResponse,
    ControlPatchRequest,
    ControlPatchResponse,
    ControlResponse,
    EvidenceItem,
)
from app.services.compliance_engine import recalculate_tenant_controls
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()
http_bearer = HTTPBearer()


@router.get(
    "/assignees",
    response_model=list[AssigneeItem],
    dependencies=[
        Depends(http_bearer),
        Depends(require_scope("controls:read")),
    ],
)
async def list_control_assignees(
    db: AsyncSession = Depends(get_db),  # noqa: B008
):
    """
    Returns all workspace users (including Tenant Admin) so anyone with
    controls:write can reassign controls via dropdown.
    """
    stmt = select(User.user_id, User.email, User.role)
    result = await db.execute(stmt)
    rows = result.all()
    return [
        AssigneeItem(
            user_id=r.user_id,
            email=r.email or "Unknown",
            role=r.role.value if hasattr(r.role, "value") else str(r.role),
        )
        for r in rows
    ]


@router.get(
    "",
    response_model=list[ControlResponse],
    dependencies=[
        Depends(http_bearer),
        Depends(require_scope("controls:read")),
    ],
)
async def list_controls(
    framework_id: UUID | None = Query(None),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
):
    stmt = (
        select(Control, EvidenceRequirement.requirement_id)
        .outerjoin(
            EvidenceRequirement,
            EvidenceRequirement.control_id == Control.control_id,
        )
        .outerjoin(
            User,
            User.user_id == Control.owner,
        )
    )
    if framework_id:
        stmt = stmt.where(Control.framework_id == framework_id)

    result = await db.execute(stmt)
    rows = result.all()
    controls = []
    for ctrl, req_id in rows:
        item = ControlResponse.model_validate(ctrl)
        item.requirement_id = req_id
        controls.append(item)
    return controls


@router.get(
    "/{control_id}",
    response_model=ControlResponse,
    dependencies=[
        Depends(http_bearer),
        Depends(require_scope("controls:read")),
    ],
)
async def get_control(
    control_id: UUID,
    db: AsyncSession = Depends(get_db),  # noqa: B008
):
    stmt = (
        select(Control, EvidenceRequirement.requirement_id)
        .outerjoin(
            EvidenceRequirement,
            EvidenceRequirement.control_id == Control.control_id,
        )
        .outerjoin(
            User,
            User.user_id == Control.owner,
        )
        .where(Control.control_id == control_id)
    )

    result = await db.execute(stmt)
    row = result.first()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Control not found."
        )

    ctrl, req_id = row
    item = ControlResponse.model_validate(ctrl)
    item.requirement_id = req_id
    return item


@router.post(
    "/calculate",
    response_model=list[ControlResponse],
    dependencies=[
        Depends(http_bearer),
        Depends(require_scope("controls:write")),
    ],
)
async def calculate_controls(
    payload: ControlCalculateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),  # noqa: B008
):
    """
    Recalculate compliance status for one control or all controls
    belonging to the current tenant.

    RLS enforces tenant isolation. No tenant_id filter is applied
    to the control query in Python.
    """
    tenant_id, _user_id = get_tenant_and_user(request)

    try:
        controls = await recalculate_tenant_controls(
            db=db,
            tenant_id=tenant_id,
            control_id=payload.control_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Control not found.",
        ) from exc

    return controls


@router.patch(
    "/{control_id}",
    response_model=ControlPatchResponse,
    dependencies=[
        Depends(http_bearer),
        Depends(require_scope("controls:write")),
    ],
)
async def patch_control(
    control_id: UUID,
    payload: ControlPatchRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),  # noqa: B008
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
        owner_check = await db.execute(
            select(User).where(
                User.user_id == payload.owner,
            )
        )

        if owner_check.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=400,
                detail="Owner must be a valid user in this tenant.",
            )

        control.owner = payload.owner

    if payload.notes is not None:
        control.notes = payload.notes

    await db.commit()

    return ControlPatchResponse(message=f"Control {control_id} successfully updated")


@router.get(
    "/{control_id}/evidence",
    response_model=ControlEvidenceResponse,
    dependencies=[
        Depends(http_bearer),
        Depends(require_scope("evidence:read")),
    ],
)
async def get_control_evidence(
    control_id: UUID,
    db: AsyncSession = Depends(get_db),  # noqa: B008
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Control not found.",
        )

    # Fetch evidence — RLS auto-filters by tenant
    evidence_stmt = select(Evidence).where(Evidence.control_id == control_id)
    evidence_result = await db.execute(evidence_stmt)
    evidence_rows = evidence_result.scalars().all()

    return ControlEvidenceResponse(
        control_id=control_id,
        evidence=[EvidenceItem.model_validate(e) for e in evidence_rows],
    )
