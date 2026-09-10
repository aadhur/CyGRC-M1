import logging
from uuid import UUID

import httpx
from app.api.deps import require_scope
from app.db.models import User, UserRole, UserStatus
from app.db.session import get_db
from app.schemas.users import (
    DeleteUserResponse,
    InviteRequest,
    InviteResponse,
    UserListResponse,
    UserResponse,
)
from app.services.keycloak import delete_keycloak_user, provision_user_in_keycloak
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from uuid6 import uuid7

router = APIRouter()
logger = logging.getLogger("cygrc.invite")
security_scheme = HTTPBearer()


@router.get(
    "",
    response_model=UserListResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(security_scheme),
        Depends(require_scope("users:read")),
    ],
)
async def list_users(
    db: AsyncSession = Depends(get_db),  # noqa: B008
):

    # 2. Query users scoped to tenant_id (RLS filters automatically, explicit filter for safety)
    stmt = select(User).where(User.role != "TENANT_ADMIN")
    result = await db.execute(stmt)
    users = result.scalars().all()

    # 3. Serialize and return list
    user_list = [UserResponse.model_validate(u) for u in users]

    return UserListResponse(
        users=user_list,
        total=len(user_list),
        message="No users found under this tenant." if not user_list else None,
    )


@router.post(
    "/invite",
    response_model=InviteResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(security_scheme),
        Depends(require_scope("users:write")),
    ],
)
async def invite_user(
    request: Request,
    payload: InviteRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
):
    # 1. Authorize role: only tenant_admin allowed
    role = payload.validated_user_role()

    if role in {
        UserRole.TENANT_ADMIN,
        UserRole.PLATFORM_OPERATOR,
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Can't invite those roles.",
        )

    tenant_id = str(request.state.tenant_id)

    # 2. Provision identity in Keycloak bound to admin's tenant_id
    _, kc_user_id = await provision_user_in_keycloak(
        email=payload.email,
        password=payload.password,
        tenant_id=str(tenant_id),
        role=role,
    )

    try:
        user = User(
            user_id=uuid7(),
            tenant_id=request.state.tenant_id,
            email=payload.email,
            role=role,
            kc_user_id=kc_user_id,
            status=UserStatus.ACTIVE,
        )
        db.add(user)
        await db.commit()

    except SQLAlchemyError as e:
        await db.rollback()
        logger.exception("Invite failed to persist user record. Rollback executed.")
        if kc_user_id:
            try:
                await delete_keycloak_user(kc_user_id)
            except (HTTPException, httpx.HTTPError) as delete_exc:
                logger.error(
                    f"Failed to delete orphaned Keycloak user {kc_user_id}: {delete_exc!s}"
                )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User created in Keycloak but failed to save locally",
        ) from e

    return InviteResponse(
        user_id=user.user_id,
        email=payload.email,
        role=role,
        message=f"{payload.email} invited as {payload.role.value}.",
    )


@router.delete(
    "/{user_id}",
    response_model=DeleteUserResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(security_scheme),
        Depends(require_scope("users:delete")),
    ],
)
async def remove_user(
    user_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),  # noqa: B008
):
    # 1. Authorize role: only tenant_admin allowed
    user_roles = getattr(request.state, "roles", [])
    if "TENANT_ADMIN" not in user_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a tenant admin can remove users.",
        )

    # 2. Fetch user and verify tenant isolation
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    user_email = user.email

    # 3. Revoke access in Keycloak first
    try:
        await delete_keycloak_user(user.kc_user_id)
    except Exception as e:
        logger.exception(f"Failed to delete user {user_id} from Keycloak.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to revoke access in Keycloak: {e!s}",
        ) from e

    # 4. Clean up local Postgres record after Keycloak deletion succeeds
    try:
        await db.delete(user)
        await db.commit()
    except SQLAlchemyError as e:
        await db.rollback()
        logger.exception(
            "Failed to delete user record from database. Rollback executed."
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"User access revoked in Keycloak but failed to delete local record: {e!s}",
        ) from e

    return DeleteUserResponse(
        user_id=user_id,
        email=user_email,
        message=f"{user_email} removed successfully.",
    )
