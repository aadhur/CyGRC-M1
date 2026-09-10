import logging

import httpx
from app.api.deps import load_seed_files
from app.db.models import (
    Control,
    ControlStatus,
    EvidenceRequirement,
    Framework,
    Tenant,
    TenantStatus,
    User,
    UserStatus,
)
from app.db.session import get_onboard_db
from app.schemas.onboard import OnboardRequest, OnboardResponse
from app.services.keycloak import delete_keycloak_user, provision_user_in_keycloak
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from uuid6 import uuid7

router = APIRouter()
logger = logging.getLogger("cygrc.onboard")

# ── Router ─────────────────────────────────────────────────────────────────


@router.post(
    "/v1/onboard",
    response_model=OnboardResponse,
    status_code=status.HTTP_201_CREATED,
)
async def onboard_tenant(
    payload: OnboardRequest,
    db: AsyncSession = Depends(get_onboard_db),  # noqa: B008
):
    tenant_id = uuid7()
    user_id = uuid7()
    kc_user_id = None
    try:
        jwt_token, kc_user_id = await provision_user_in_keycloak(
            email=payload.email,
            password=payload.password,
            tenant_id=str(tenant_id),
            role="TENANT_ADMIN",
        )
    except Exception as e:
        logger.exception("Failed to provision user in Keycloak")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Identity provider provision failed: {e!s}",
        ) from e
    try:
        await db.execute(
            text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
            {"tenant_id": str(tenant_id)},
        )

        # Create the tenant in 'provisioning' state
        tenant = Tenant(
            tenant_id=tenant_id,
            name=payload.name,
            plan=payload.plan,
            status=TenantStatus.PROVISIONING,
        )
        db.add(tenant)
        await db.flush()

        user = User(
            user_id=user_id,
            tenant_id=tenant.tenant_id,
            email=payload.email,
            role="TENANT_ADMIN",
            kc_user_id=kc_user_id,
            status=UserStatus.ACTIVE,
        )
        db.add(user)
        await db.flush()

        framework_seed_map = await load_seed_files(
            "*.json", exclude_pattern="*_requirements.json"
        )

        requirement_seed_map = await load_seed_files("*_requirements.json")

        # Query the database master frameworks catalogue
        framework_query = await db.execute(select(Framework))
        db_frameworks = framework_query.scalars().all()

        for framework in db_frameworks:
            if framework.code not in framework_seed_map:
                continue

            seed_data = framework_seed_map[framework.code]

            requirement_data = requirement_seed_map.get(framework.code)

            if requirement_data is None:
                logger.warning(
                    f"No requirement seed file found for framework {framework.code}"
                )
                continue

            requirement_config = requirement_data["requirement"]

            for ctrl in seed_data.get("controls", []):
                control = Control(
                    control_id=uuid7(),
                    tenant_id=tenant.tenant_id,
                    framework_id=framework.framework_id,
                    code=ctrl["code"],
                    title=ctrl["title"],
                    description=ctrl["description"],
                    owner=user.user_id,
                    status=ControlStatus.NOT_ASSESSED,
                    notes=None,
                )

                db.add(control)

                requirement = EvidenceRequirement(
                    tenant_id=tenant.tenant_id,
                    requirement_id=uuid7(),
                    control_id=control.control_id,
                    type=requirement_config["type"],
                    cadence_days=requirement_config["cadence_days"],
                    description=requirement_config["description"],
                )

                db.add(requirement)

        # Flip status to active and commit atomically
        tenant.status = TenantStatus.ACTIVE
        await db.commit()

    except Exception as e:
        await db.rollback()
        logger.exception("Onboarding transactional loop failed. Rollback executed.")
        if kc_user_id:
            try:
                await delete_keycloak_user(kc_user_id)
                logger.info(f"Successfully cleaned up Keycloak user {kc_user_id}")
            except (HTTPException, httpx.HTTPError) as kc_err:
                logger.error(
                    f"CRITICAL: Failed to clean up Keycloak user {kc_user_id}: {kc_err}"
                )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Onboarding transactional loop failed. Database rolled back: {e!s}",
        ) from e

    return OnboardResponse(
        tenant_id=tenant.tenant_id,
        user_id=user.user_id,
        status=tenant.status,
        message=f"Tenant '{tenant.name}' registered successfully and master frameworks seeded.",
        access_token=jwt_token,
    )
