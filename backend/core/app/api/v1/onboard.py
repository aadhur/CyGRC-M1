import json
import logging
from pathlib import Path
from typing import Any

import anyio
import httpx
from app.db.models import (
    Control,
    ControlStatus,
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

# ── Thread-Safe File Helper (Prevents ASYNC230) ───────────────────────────


def load_json_file(file_path: Path) -> dict[str, Any]:
    """Helper method to read a JSON file synchronously within an isolated worker thread."""
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


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
            role="tenant_admin",
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
            status=TenantStatus.provisioning,
        )
        db.add(tenant)
        await db.flush()

        user = User(
            user_id=user_id,
            tenant_id=tenant.tenant_id,
            email=payload.email,
            role="tenant_admin",
            kc_user_id=kc_user_id,
            status=UserStatus.active,
        )
        db.add(user)
        await db.flush()

        seeds_dir = Path(__file__).resolve().parents[2] / "seeds"
        code_to_file_map = {}

        if seeds_dir:
            for json_file in seeds_dir.glob("*.json"):
                try:
                    # Offload the blocking read to anyio's worker threads (ASYNC230)
                    file_data = await anyio.to_thread.run_sync(
                        load_json_file, json_file
                    )
                    json_code = file_data.get("metadata", {}).get("code")
                    if json_code:
                        code_to_file_map[json_code] = json_file
                except (OSError, json.JSONDecodeError) as e:
                    logger.warning(
                        f"Failed to load or parse seed file {json_file}: {e}"
                    )
                    continue

        # Query the database master frameworks catalogue
        framework_query = await db.execute(select(Framework))
        db_frameworks = framework_query.scalars().all()

        for framework in db_frameworks:
            if framework.code not in code_to_file_map:
                continue
            try:
                # Offload the blocking read to anyio's worker threads (ASYNC230)
                seed_data = await anyio.to_thread.run_sync(
                    load_json_file, code_to_file_map[framework.code]
                )
            except (OSError, json.JSONDecodeError) as e:
                logger.warning(
                    f"Failed to load or parse framework seed file for code {framework.code}: {e}"
                )
                continue

            for ctrl in seed_data.get("controls", []):
                control = Control(
                    control_id=uuid7(),
                    tenant_id=tenant.tenant_id,
                    framework_id=framework.framework_id,
                    code=ctrl["code"],
                    title=ctrl["title"],
                    description=ctrl["description"],
                    owner=user.user_id,
                    status=ControlStatus.not_assessed,
                    notes=None,
                )
                db.add(control)

        # Flip status to active and commit atomically
        tenant.status = TenantStatus.active
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
