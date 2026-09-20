import base64
import json
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import fakeredis.aioredis
import jwt
import pytest
import pytest_asyncio
from app.db.models import Tenant, User, UserRole, UserStatus
from app.db.session import (  # <--- Added get_onboard_db
    get_db,
    get_onboard_db,
    tenant_id_context,
)
from app.main import app
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import Request  # <--- Added
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from uuid6 import uuid7

TEST_DATABASE_URL = (
    "postgresql+asyncpg://grc_app_test:test_password_123@localhost:5432/grc_platform"
)


@pytest.fixture(scope="session")
def rsa_keypair():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()
    return private_key, public_key


@pytest.fixture(scope="session")
def jwks_data(rsa_keypair) -> dict[str, Any]:
    _, public_key = rsa_keypair
    pn = public_key.public_numbers()

    def to_b64u(n: int) -> str:
        data = n.to_bytes((n.bit_length() + 7) // 8, byteorder="big")
        return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")

    return {
        "keys": [
            {
                "kty": "RSA",
                "kid": "test-key-id",
                "use": "sig",
                "alg": "RS256",
                "n": to_b64u(pn.n),
                "e": to_b64u(pn.e),
            }
        ]
    }


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    # NullPool ensures connections are immediately closed and not shared across tests
    engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    session_maker = async_sessionmaker(bind=test_engine, expire_on_commit=False)
    async with session_maker() as session:
        try:
            yield session
        finally:
            await session.rollback()
            await session.close()


@pytest_asyncio.fixture(autouse=True)
async def setup_valkey_mock(jwks_data, monkeypatch):
    fake_valkey = fakeredis.aioredis.FakeRedis(decode_responses=True)
    await fake_valkey.set("jwks:test-key-id", json.dumps(jwks_data["keys"][0]))
    monkeypatch.setattr("app.middleware.auth.valkey", fake_valkey)
    yield fake_valkey
    await fake_valkey.flushall()
    await fake_valkey.aclose()


@pytest.fixture
def make_auth_token(rsa_keypair):
    private_key, _ = rsa_keypair

    def _generate(
        tenant_id: UUID | None = None,
        user_id: UUID | None = None,
        role: str = "TENANT_ADMIN",
        custom_sub: str | None = None,
        lifetime_seconds: int = 3600,
        omit_tenant_id: bool = False,
        omit_sub: bool = False,
    ) -> str:
        now = datetime.now(timezone.utc)
        payload: dict[str, Any] = {
            "realm_access": {"roles": [role]},
            "iat": int(now.timestamp()),
            "exp": int(now.timestamp()) + lifetime_seconds,
        }
        if not omit_sub:
            payload["sub"] = custom_sub or str(user_id or uuid7())
        if not omit_tenant_id and tenant_id:
            payload["tenant_id"] = str(tenant_id)

        pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        return jwt.encode(
            payload, pem, algorithm="RS256", headers={"kid": "test-key-id"}
        )

    return _generate


@pytest_asyncio.fixture
async def client(test_engine, monkeypatch) -> AsyncGenerator[AsyncClient, None]:
    session_factory = async_sessionmaker(bind=test_engine, expire_on_commit=False)

    # Patch AsyncSessionLocal across all modules so middleware uses test_engine
    monkeypatch.setattr("app.db.session.AsyncSessionLocal", session_factory)
    monkeypatch.setattr("app.middleware.auth.AsyncSessionLocal", session_factory)
    monkeypatch.setattr("app.middleware.audit.AsyncSessionLocal", session_factory)

    async def _test_get_db(request: Request):
        tenant_id = getattr(request.state, "tenant_id", None) or tenant_id_context.get()
        async with session_factory() as session:
            try:
                if tenant_id:
                    await session.execute(
                        text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
                        {"tenant_id": str(tenant_id)},
                    )
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    async def _test_get_onboard_db():
        async with session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app.dependency_overrides[get_db] = _test_get_db
    app.dependency_overrides[get_onboard_db] = _test_get_onboard_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def real_tenants(db_session):
    """Seeds two isolated active tenants and admin users into the database."""
    tenant_a_id = uuid7()
    tenant_b_id = uuid7()
    user_a_id = uuid7()
    user_b_id = uuid7()

    tenant_a = Tenant(tenant_id=tenant_a_id, name="Tenant Alpha", plan="ENTERPRISE")
    tenant_b = Tenant(tenant_id=tenant_b_id, name="Tenant Beta", plan="PRO")
    db_session.add_all([tenant_a, tenant_b])
    await db_session.flush()

    # Seed Tenant A admin
    await db_session.execute(
        text("SELECT set_config('app.tenant_id', :t, true)"), {"t": str(tenant_a_id)}
    )
    user_a = User(
        user_id=user_a_id,
        tenant_id=tenant_a_id,
        email="admin@alpha.local",
        role=UserRole.TENANT_ADMIN,
        kc_user_id=str(user_a_id),
        status=UserStatus.ACTIVE,
    )
    db_session.add(user_a)

    # Seed Tenant B admin
    await db_session.execute(
        text("SELECT set_config('app.tenant_id', :t, true)"), {"t": str(tenant_b_id)}
    )
    user_b = User(
        user_id=user_b_id,
        tenant_id=tenant_b_id,
        email="admin@beta.local",
        role=UserRole.TENANT_ADMIN,
        kc_user_id=str(user_b_id),
        status=UserStatus.ACTIVE,
    )
    db_session.add(user_b)
    await db_session.commit()

    return {
        "tenant_a": tenant_a_id,
        "user_a": user_a_id,
        "tenant_b": tenant_b_id,
        "user_b": user_b_id,
    }
