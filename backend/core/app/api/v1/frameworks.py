from app.db.models import Framework
from app.db.session import get_db
from app.schemas.frameworks import FrameworkResponse
from fastapi import APIRouter, Depends
from fastapi.security import HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()
http_bearer = HTTPBearer()


@router.get(
    "/v1/frameworks",
    response_model=list[FrameworkResponse],
    dependencies=[Depends(http_bearer)],
)
async def list_frameworks(
    db: AsyncSession = Depends(get_db),  # noqa: B008
    # _scope = Depends(lambda: require_scope("controls:read"))
):
    """
    Lists all master compliance frameworks supported by the platform.
    """
    stmt = select(Framework)
    result = await db.execute(stmt)
    frameworks = result.scalars().all()
    return frameworks
