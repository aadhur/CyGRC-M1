# POST /v1/onboard — registers a new tenant and creates the initial admin user.
# Sets tenant status to "provisioning"; S1 and S2 squads watch for this
# status to seed the control library for the tenant.

from uuid import UUID

import uuid6
from app.db.models import Tenant, User
from app.db.session import get_db
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────


class OnboardRequest(BaseModel):
    name: str
    plan: str
    email: EmailStr | None = None


class OnboardResponse(BaseModel):
    tenant_id: UUID
    user_id: UUID
    status: str
    message: str


# ── Route ─────────────────────────────────────────────────────────────────


@router.post(
    "/v1/onboard",
    response_model=OnboardResponse,
    status_code=status.HTTP_201_CREATED,
)
async def onboard_tenant(
    payload: OnboardRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
):

    try:
        tenant = Tenant(
            tenant_id=uuid6.uuid7(),
            name=payload.name,
            plan=payload.plan,
            status="provisioning",
        )
        db.add(tenant)
        await db.flush()

        user = User(
            user_id=uuid6.uuid7(),
            tenant_id=tenant.tenant_id,
            email=payload.email,
            status="invited",
        )
        db.add(user)
        await db.commit()
        await db.refresh(tenant)
        await db.refresh(user)

    except Exception:  # noqa: BLE001
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Tenant provisioning failed. Transaction rolled back.",
        )

    return OnboardResponse(
        tenant_id=tenant.tenant_id,
        user_id=user.user_id,
        status=tenant.status,
        message=f"Tenant '{tenant.name}' created successfully with status 'provisioning'.",
    )
