from uuid import UUID

from app.api.deps import get_tenant_and_user, require_scope
from app.db.models import Risk, RiskControl, RiskStatusEnum
from app.db.session import get_db
from app.schemas.risks import GetListRiskResponse, PostRiskRequest, PostRiskResponse
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from uuid6 import uuid7

router = APIRouter()
http_bearer = HTTPBearer()


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
        response = []

        for risk in risks:
            conresult = await db.scalars(
                select(RiskControl.control_id).where(
                    RiskControl.risk_id == risk.risk_id,
                )
            )
        result_controls = conresult.all()

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
                "control_ids": result_controls,
            }
        )

        return response

    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not get risks.",
        )
