from collections.abc import AsyncGenerator
from uuid import UUID

from fastapi import HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import AsyncSessionLocal


async def get_tenant_db(
    request: Request,
) -> AsyncGenerator[AsyncSession, None]:
    tenant_id: UUID | None = getattr(
        request.state, "tenant_id", None
    )

    if tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing tenant context.",
        )

    async with AsyncSessionLocal() as db:
        await db.execute(
            text(
                "SELECT set_config('app.tenant_id', :tenant_id, true)"
            ),
            {"tenant_id": str(tenant_id)},
        )

        yield db