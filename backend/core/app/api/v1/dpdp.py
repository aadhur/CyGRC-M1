from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.api.deps import get_tenant_and_user, require_scope
from app.db.models import BreachClockStatus, DpdpBreachClock
from app.db.session import get_db
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class BreachClockResponse(BaseModel):
    status: BreachClockStatus
    started_at: datetime | None
    acknowledged_by: UUID | None
    notified_at: datetime | None
    deadline: datetime | None

    model_config = ConfigDict(from_attributes=True)


router = APIRouter()


@router.get(
    "",
    response_model=BreachClockResponse,
    dependencies=[
        Depends(HTTPBearer()),
        Depends(require_scope("dpdp:read")),
    ],
)
async def get_breach_clock(
    db: AsyncSession = Depends(get_db),  # noqa: B008
):
    """
    Return the current tenant's DPDP breach clock.

    If no clock exists yet, return the default INACTIVE state.
    """
    result = await db.execute(
        select(DpdpBreachClock).where(
            DpdpBreachClock.status == BreachClockStatus.ACTIVE
        )
    )
    clock = result.scalar_one_or_none()

    if clock is None:
        return BreachClockResponse(
            status=BreachClockStatus.INACTIVE,
            started_at=None,
            acknowledged_by=None,
            notified_at=None,
            deadline=None,
        )

    deadline = None
    if clock.started_at is not None:
        deadline = clock.started_at + timedelta(hours=72)

    return BreachClockResponse(
        status=clock.status,
        started_at=clock.started_at,
        acknowledged_by=clock.acknowledged_by,
        notified_at=clock.notified_at,
        deadline=deadline,
    )


@router.post(
    "/start",
    response_model=BreachClockResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(HTTPBearer()),
        Depends(require_scope("dpdp:write")),
    ],
)
async def start_breach_clock(
    tenant_user: tuple[UUID, UUID] = Depends(get_tenant_and_user),
    db: AsyncSession = Depends(get_db),  # noqa: B008
):
    """
    Start the tenant's DPDP breach clock.

    Reject if an ACTIVE clock already exists.
    """
    tenant_id, user_id = tenant_user

    result = await db.execute(select(DpdpBreachClock))
    clock = result.scalar_one_or_none()

    if clock is not None and clock.status == BreachClockStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A breach clock is already active for this tenant.",
        )

    now = datetime.now(timezone.utc)

    if clock is None:
        clock = DpdpBreachClock(
            tenant_id=tenant_id,
            started_at=now,
            acknowledged_by=user_id,
            status=BreachClockStatus.ACTIVE,
            notified_at=None,
        )
        db.add(clock)
    else:
        clock.started_at = now
        clock.acknowledged_by = user_id
        clock.status = BreachClockStatus.ACTIVE
        clock.notified_at = None

    await db.commit()

    return BreachClockResponse(
        status=clock.status,
        started_at=clock.started_at,
        acknowledged_by=clock.acknowledged_by,
        notified_at=clock.notified_at,
        deadline=clock.started_at + timedelta(hours=72),
    )


@router.post(
    "/resolve",
    response_model=BreachClockResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(HTTPBearer()),
        Depends(require_scope("dpdp:write")),
    ],
)
async def resolve_breach_clock(
    db: AsyncSession = Depends(get_db),  # noqa: B008
):
    """
    Resolve the tenant's current DPDP breach clock.
    """

    result = await db.execute(select(DpdpBreachClock))
    clock = result.scalar_one_or_none()

    if clock is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No breach clock exists for this tenant.",
        )

    clock.status = BreachClockStatus.RESOLVED

    await db.commit()

    deadline = None
    if clock.started_at is not None:
        deadline = clock.started_at + timedelta(hours=72)

    return BreachClockResponse(
        status=clock.status,
        started_at=clock.started_at,
        acknowledged_by=clock.acknowledged_by,
        notified_at=clock.notified_at,
        deadline=deadline,
    )
