from uuid import UUID

from app.api.deps import get_tenant_and_user, require_scope
from app.db.models import Risk, RiskControl, RiskStatusEnum
from app.db.session import get_db
from app.schemas.risks import (
    GetListRiskResponse,
    GetRiskResponse,
    PostRiskRequest,
    PostRiskResponse,
    RiskCloseRequest,
    RiskCloseResponse,
    RiskPatchRequest,
    RiskPatchResponse,
)
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from uuid6 import uuid7

router = APIRouter()
http_bearer = HTTPBearer()

# Threshold above which a risk requires CISO sign-off to close.
CISO_SIGNOFF_THRESHOLD = 16


@router.post(
    "",
    response_model=PostRiskResponse,
    dependencies=[
        Depends(http_bearer),
        Depends(require_scope("risks:write")),
    ],
)
async def add_risk(
    payload: PostRiskRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(get_tenant_and_user),
):
    tenant_id, _ = tenant_user

    try:
        risk = Risk(
            tenant_id=tenant_id,
            risk_id=uuid7(),
            title=payload.title,
            description=payload.description,
            likelihood=payload.likelihood,
            impact=payload.impact,
            inherent_risk_score=payload.likelihood * payload.impact,
            treatment=payload.treatment,
            treatment_plan=payload.treatment_plan,
            target_close_date=payload.target_close_date,
            status=RiskStatusEnum.OPEN,
        )
        db.add(risk)
        for ctrl in payload.control_ids:
            risk_control = RiskControl(
                risk_id=risk.risk_id,
                control_id=ctrl,
                tenant_id=tenant_id,
            )
            db.add(risk_control)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not add risk.",
        )
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while adding risk.",
        )
    return PostRiskResponse(risk_id=risk.risk_id, msg="Risk successfully added.")


@router.get(
    "",
    response_model=GetListRiskResponse,
    dependencies=[
        Depends(http_bearer),
        Depends(require_scope("risks:read")),
    ],
)
async def get_risk(
    db: AsyncSession = Depends(get_db),  # noqa: B008
):
    try:
        result = await db.scalars(select(Risk))
        risks = result.all()

        risk_controls_result = await db.execute(
            select(RiskControl.risk_id, RiskControl.control_id)
        )

        controls_by_risk = {}
        for risk_id, control_id in risk_controls_result.all():
            controls_by_risk.setdefault(risk_id, []).append(control_id)

        response = []

        for risk in risks:
            response.append(
                {
                    "risk_id": risk.risk_id,
                    "title": risk.title,
                    "description": risk.description,
                    "likelihood": risk.likelihood,
                    "impact": risk.impact,
                    "inherent_score": risk.inherent_risk_score,
                    "residual_score": risk.residual_risk_score,
                    "treatment": risk.treatment,
                    "treatment_plan": risk.treatment_plan,
                    "target_close_date": risk.target_close_date,
                    "status": risk.status,
                    "control_ids": controls_by_risk.get(risk.risk_id, []),
                }
            )

        return response

    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not get risks.",
        )


@router.get(
    "/{risk_id}",
    response_model=GetRiskResponse,
    dependencies=[
        Depends(http_bearer),
        Depends(require_scope("risks:read")),
    ],
)
async def get_single_risk(
    risk_id: UUID,
    db: AsyncSession = Depends(get_db),  # noqa: B008
):
    """
    Fetch a single risk by UUID with its associated control IDs.
    PostgreSQL Row-Level Security automatically isolates cross-tenant access.
    """
    stmt = select(Risk).where(Risk.risk_id == risk_id)
    result = await db.execute(stmt)
    risk = result.scalar_one_or_none()

    if risk is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Risk '{risk_id}' not found.",
        )

    # Fetch linked control IDs
    ctrl_stmt = select(RiskControl.control_id).where(RiskControl.risk_id == risk_id)
    ctrl_res = await db.execute(ctrl_stmt)
    linked_control_ids = ctrl_res.scalars().all()

    return GetRiskResponse(
        risk_id=risk.risk_id,
        title=risk.title,
        description=risk.description,
        likelihood=risk.likelihood,
        impact=risk.impact,
        inherent_score=risk.inherent_risk_score,
        residual_score=risk.residual_risk_score,
        treatment=risk.treatment,
        treatment_plan=risk.treatment_plan,
        target_close_date=risk.target_close_date,
        status=risk.status,
        control_ids=list(linked_control_ids),
    )


@router.patch(
    "/{risk_id}",
    response_model=RiskPatchResponse,
    dependencies=[Depends(http_bearer), Depends(require_scope("risks:write"))],
)
async def patch_risk(
    risk_id: UUID,
    payload: RiskPatchRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(get_tenant_and_user),
):
    """
    Update ratings, treatment plan, or status of an existing risk.
    RLS enforces tenant isolation automatically, no manual tenant_id
    filtering in the query below.
    """
    stmt = select(Risk).where(Risk.risk_id == risk_id)
    result = await db.execute(stmt)
    risk = result.scalar_one_or_none()

    if risk is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Risk not found."
        )

    # Only update fields explicitly provided in the request
    update_data = payload.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"] in (
        RiskStatusEnum.CLOSED.value,
        RiskStatusEnum.ACCEPTED.value,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Risks can't be closed or accepted here.",
        )

    for field, value in update_data.items():
        setattr(risk, field, value)

    # Keep inherent_risk_score in sync if either input changed
    if "likelihood" in update_data or "impact" in update_data:
        risk.inherent_risk_score = risk.likelihood * risk.impact

    await db.commit()

    return RiskPatchResponse(
        risk_id=risk.risk_id, message=f"Risk {risk_id} successfully updated"
    )


@router.post(
    "/{risk_id}/close",
    response_model=RiskCloseResponse,
    dependencies=[Depends(http_bearer), Depends(require_scope("risks:close"))],
)
async def close_risk(
    risk_id: UUID,
    request: Request,
    payload: RiskCloseRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
):
    """
    Close (or accept) a risk. Two business rules gate this:
      1. treatment_plan must not be blank/null when closing.
      2. If inherent_risk_score >= 16, only a caller with the CISO role
         (checked directly against request.state.roles, not scopes) may
         close it.
    """
    if payload.status not in (
        RiskStatusEnum.CLOSED.value,
        RiskStatusEnum.ACCEPTED.value,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="status must be 'CLOSED' or 'ACCEPTED'.",
        )

    try:
        stmt = select(Risk).where(Risk.risk_id == risk_id)
        result = await db.execute(stmt)
        risk = result.scalar_one_or_none()

        if risk is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Risk not found."
            )

        if not risk.treatment_plan or not risk.treatment_plan.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot close a risk with no treatment plan.",
            )

        if (
            risk.inherent_risk_score is not None
            and risk.inherent_risk_score >= CISO_SIGNOFF_THRESHOLD
        ):
            roles = getattr(request.state, "roles", None) or []
            if "CISO" not in roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Closing a high-inherent-risk item requires CISO sign-off.",
                )

        risk.status = RiskStatusEnum(payload.status)
        await db.commit()

    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Could not close risk."
        )
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while closing risk.",
        )

    return RiskCloseResponse(
        risk_id=risk.risk_id,
        status=risk.status.value,
        message="Risk closed successfully.",
    )
