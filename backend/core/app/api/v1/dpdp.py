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
    deadline: datetime | None
    resolved_at: datetime | None = None

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
    result = await db.execute(
        select(DpdpBreachClock).where(
            DpdpBreachClock.status == BreachClockStatus.ACTIVE
        )
    )
    clock = result.scalar_one_or_none()

    if clock is None:
        # Check if there is a resolved clock
        res_all = await db.execute(
            select(DpdpBreachClock).order_by(DpdpBreachClock.started_at.desc())
        )
        latest = res_all.scalars().first()
        if latest and latest.status == BreachClockStatus.RESOLVED:
            return BreachClockResponse(
                status=BreachClockStatus.RESOLVED,
                started_at=latest.started_at,
                acknowledged_by=latest.acknowledged_by,
                deadline=None,
                resolved_at=getattr(latest, "resolved_at", None),
            )

        return BreachClockResponse(
            status=BreachClockStatus.INACTIVE,
            started_at=None,
            acknowledged_by=None,
            deadline=None,
            resolved_at=None,
        )

    deadline = None
    if clock.started_at is not None:
        deadline = clock.started_at + timedelta(hours=72)

    return BreachClockResponse(
        status=clock.status,
        started_at=clock.started_at,
        acknowledged_by=clock.acknowledged_by,
        deadline=deadline,
        resolved_at=getattr(clock, "resolved_at", None),
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
        )
        db.add(clock)
    else:
        clock.started_at = now
        clock.acknowledged_by = user_id
        clock.status = BreachClockStatus.ACTIVE
        if hasattr(clock, "resolved_at"):
            clock.resolved_at = None

    await db.commit()

    return BreachClockResponse(
        status=clock.status,
        started_at=clock.started_at,
        acknowledged_by=clock.acknowledged_by,
        deadline=clock.started_at + timedelta(hours=72),
        resolved_at=None,
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
    result = await db.execute(select(DpdpBreachClock))
    clock = result.scalar_one_or_none()

    if clock is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No breach clock exists for this tenant.",
        )

    now = datetime.now(timezone.utc)
    clock.status = BreachClockStatus.RESOLVED
    if hasattr(clock, "resolved_at"):
        clock.resolved_at = now

    await db.commit()

    return BreachClockResponse(
        status=clock.status,
        started_at=clock.started_at,
        acknowledged_by=clock.acknowledged_by,
        deadline=None,
        resolved_at=getattr(clock, "resolved_at", now),
    )
