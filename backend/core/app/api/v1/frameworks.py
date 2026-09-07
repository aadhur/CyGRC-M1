from app.db.models import Framework
from app.db.session import get_db
from app.schemas.frameworks import FrameworkCreateRequest, FrameworkResponse
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from uuid6 import uuid7

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


@router.post(
    "/v1/frameworks",
    response_model=FrameworkResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(http_bearer)],
)
async def create_framework(
    payload: FrameworkCreateRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    # _scope = Depends(lambda: require_scope("operator:admin")),
    # wire the actual scope check here (blocked on scope-checking mechanism existing)
):
    """
    Adds a new framework to the shared master catalog.

    Requires operator:admin scope -- this is a platform-admin action, not
    something an ordinary tenant user can call.
    """
    framework = Framework(
        framework_id=uuid7(),
        code=payload.code,
        version=payload.version,
        name=payload.name,
    )
    db.add(framework)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Framework with code '{payload.code}' already exists.",
        )

    await db.refresh(framework)
    return framework
