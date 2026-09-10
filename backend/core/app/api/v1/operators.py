import logging

from app.api.deps import require_scope
from app.db.models import Tenant
from app.db.session import get_db
from app.schemas.operators import TenantListItem, TenantListResponse
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()
logger = logging.getLogger("cygrc.operators")
security_scheme = HTTPBearer()


@router.get(
    "/tenants",
    response_model=TenantListResponse,
    dependencies=[
        Depends(security_scheme),
        Depends(require_scope("operator:admin")),
    ],
    status_code=status.HTTP_200_OK,
)
async def list_tenants(request: Request, db: AsyncSession = Depends(get_db)):  # noqa: B008
    """
    Queries the global tenants registry table (which lives outside RLS)
    to return a list of all active corporate tenants, their current onboarding
    status, creation date, and subscription plans.
    """

    try:
        # Execute direct select statement on the tenants registry table
        stmt = select(Tenant).order_by(Tenant.created_at.desc())
        result = await db.execute(stmt)
        tenants = result.scalars().all()

        return TenantListResponse(
            tenants=[TenantListItem.model_validate(t) for t in tenants]
        )
    except SQLAlchemyError as e:
        logger.error(f"Failed to query tenants list: {e!s}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching the tenants registry.",
        )
