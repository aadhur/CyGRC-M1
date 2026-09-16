from uuid import UUID

from app.api.deps import get_db, get_tenant_and_user, require_scope
from app.db.models import Risk, RiskStatusEnum
from app.schemas.risks import (
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

router = APIRouter()
http_bearer = HTTPBearer()

# Threshold above which a risk requires CISO sign-off to close.
CISO_SIGNOFF_THRESHOLD = 16


@router.patch(
    "/v1/risks/{risk_id}",
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
    _tenant_id, _user_id = tenant_user

    stmt = select(Risk).where(Risk.risk_id == risk_id)
    result = await db.execute(stmt)
    risk = result.scalar_one_or_none()

    if risk is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Risk not found."
        )

    # Only update fields explicitly provided in the request
    update_data = payload.model_dump(exclude_unset=True)
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
    "/v1/risks/{risk_id}/close",
    response_model=RiskCloseResponse,
    dependencies=[Depends(http_bearer), Depends(require_scope("risks:close"))],
)
async def close_risk(
    risk_id: UUID,
    payload: RiskCloseRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(get_tenant_and_user),
):
    """
    Close (or accept) a risk. Two business rules gate this:
      1. treatment_plan must not be blank/null when closing.
      2. If inherent_risk_score >= 16, only a caller with the CISO role
         (checked directly against request.state.roles, not scopes) may
         close it.
    """
    _tenant_id, _user_id = tenant_user

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
