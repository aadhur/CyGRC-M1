import contextvars
import os
from collections.abc import AsyncGenerator
from uuid import UUID

from fastapi import HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://grc_app_test:test_password_123@localhost:5432/grc_platform",  # fallback for running outside Docker
)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

tenant_id_context: contextvars.ContextVar[UUID | None] = contextvars.ContextVar(
    "tenant_id",
    default=None,
)


async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    tenant_id = getattr(request.state, "tenant_id", None) or tenant_id_context.get()

    if tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing tenant context in request.",
        )

    async with AsyncSessionLocal() as session:
        await session.execute(
            text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
            {"tenant_id": str(tenant_id)},
        )

        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def get_onboard_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
