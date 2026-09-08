import contextvars
from collections.abc import AsyncGenerator
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Connects to PostgreSQL running via docker-compose.yml
DATABASE_URL = (
    "postgresql+asyncpg://grc_user:grc_local_password_123@localhost:5432/grc_platform"
)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)

# This stores the active tenant UUID for the current async task loop.
tenant_id_context: contextvars.ContextVar[UUID] = contextvars.ContextVar("tenant_id")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            tenant_id = tenant_id_context.get(None)
            if tenant_id:
                # SET LOCAL ensures this setting is wiped clean as soon as this transaction ends.
                await session.execute(
                    text("SET LOCAL app.tenant_id = :tenant_id"),
                    {"tenant_id": str(tenant_id)},
                )
            yield session
        finally:
            await session.close()
