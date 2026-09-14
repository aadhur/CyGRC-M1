import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.api.deps import get_tenant_and_user, require_scope
from app.db.models import BreakGlassSession, BreakGlassStatus, Tenant
from app.db.session import get_db, get_onboard_db
from app.schemas.operators import (
    BreakGlassApproveResponse,
    BreakGlassRequestSchema,
    BreakGlassRevokeSchema,
    TenantListItem,
    TenantListResponse,
)
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


@router.post(
    "/break-glass",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_scope("operator:break-glass"))],
)
async def request_break_glass(
    payload: BreakGlassRequestSchema,
    db: AsyncSession = Depends(get_onboard_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(get_tenant_and_user),
):
    _, user_id = tenant_user

    session = BreakGlassSession(
        target_tenant_id=payload.target_tenant_id,
        requested_by=user_id,
        ticket_ref=payload.ticket_ref,
        reason=payload.reason,
        duration_hours=payload.duration_hours,
        status=BreakGlassStatus.PENDING,
    )
    db.add(session)
    await db.commit()

    logger.warning(
        f"BREAK-GLASS REQUESTED: operator={user_id} tenant={payload.target_tenant_id} "
        f"ticket={payload.ticket_ref} session={session.session_id}"
    )
    return {"message": "Break-glass request created.", "session_id": session.session_id}


@router.post(
    "/break-glass/{session_id}/approve",
    response_model=BreakGlassApproveResponse,
    dependencies=[Depends(require_scope("operator:admin"))],
)
async def approve_break_glass(
    session_id: UUID,
    db: AsyncSession = Depends(get_onboard_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(get_tenant_and_user),
):
    _, approver_id = tenant_user

    result = await db.execute(
        select(BreakGlassSession).where(BreakGlassSession.session_id == session_id)
    )
    session = result.scalar_one_or_none()

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Break-glass request not found.",
        )

    if session.requested_by == approver_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot approve your own break-glass request.",
        )

    if session.status != BreakGlassStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Session is {session.status.value}, not PENDING. Cannot approve.",
        )

    now = datetime.now(timezone.utc)
    session.approved_by = approver_id
    session.status = BreakGlassStatus.ACTIVE
    session.approved_at = now
    session.expires_at = now + timedelta(hours=session.duration_hours)

    await db.commit()

    logger.warning(
        f"BREAK-GLASS ACTIVE: operator={session.requested_by} approver={approver_id} "
        f"tenant={session.target_tenant_id} ticket={session.ticket_ref} "
        f"expires={session.expires_at.isoformat()} session={session.session_id}"
    )

    # TODO: real customer notification (PRD requires the tenant admin be
    # notified within 24 hours). No notification infrastructure exists yet.
    # The audit log entry above, plus this table itself, is the only record
    # for now — sufficient for the weekly manual review, not for automatic
    # customer notification. Do not claim this is sent; it is not.

    return BreakGlassApproveResponse(
        session_id=session.session_id,
        status=session.status.value,
        expires_at=session.expires_at,
    )


@router.post(
    "/break-glass/{session_id}/revoke",
    dependencies=[Depends(require_scope("operator:admin"))],
)
async def revoke_break_glass(
    session_id: UUID,
    payload: BreakGlassRevokeSchema,
    db: AsyncSession = Depends(get_onboard_db),  # noqa: B008
    tenant_user: tuple[UUID, UUID] = Depends(get_tenant_and_user),
):
    """
    FIXED: the original design had no way to end an active session early.
    A ticket resolving sooner than expected, or anything looking suspicious
    mid-session, had no path except waiting out the full expiry window.
    """
    _, revoker_id = tenant_user

    result = await db.execute(
        select(BreakGlassSession).where(BreakGlassSession.session_id == session_id)
    )
    session = result.scalar_one_or_none()

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Break-glass session not found.",
        )

    if session.status != BreakGlassStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Session is {session.status.value}, not ACTIVE. Nothing to revoke.",
        )

    session.status = BreakGlassStatus.REVOKED
    session.revoked_by = revoker_id
    session.revoked_at = datetime.now(timezone.utc)
    await db.commit()

    logger.warning(
        f"BREAK-GLASS REVOKED: session={session_id} revoked_by={revoker_id} reason={payload.reason}"
    )
    return {"session_id": session.session_id, "status": "REVOKED"}


@router.get(
    "/break-glass",
    dependencies=[Depends(require_scope("operator:admin"))],
)
async def list_break_glass_sessions(db: AsyncSession = Depends(get_onboard_db)):  # noqa: B008
    """For the weekly manual review the PRD requires. No filtering yet
    beyond returning everything — add pagination once this table has
    enough rows to matter."""
    result = await db.execute(
        select(BreakGlassSession).order_by(BreakGlassSession.created_at.desc())
    )
    return result.scalars().all()
