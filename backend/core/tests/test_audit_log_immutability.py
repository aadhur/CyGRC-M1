from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, ProgrammingError

pytestmark = pytest.mark.asyncio


async def get_or_create_tenant(db_session):
    res = await db_session.execute(text("SELECT tenant_id FROM tenants LIMIT 1"))
    row = res.fetchone()
    if row:
        tenant_id = row[0]
    else:
        tenant_id = uuid4()
        await db_session.execute(
            text(
                """
                INSERT INTO tenants (tenant_id, name, plan) 
                VALUES (:tid, :name, 'ENTERPRISE')
                ON CONFLICT (tenant_id) DO NOTHING
                """
            ),
            {"tid": tenant_id, "name": f"Tenant-{tenant_id}"},
        )
        await db_session.commit()

    await db_session.execute(
        text("SELECT set_config('app.tenant_id', :tid, true)"), {"tid": str(tenant_id)}
    )
    return tenant_id


async def test_audit_log_insert_normal(db_session):
    """1. Insert works normally via db_session."""
    tenant_id = await get_or_create_tenant(db_session)
    log_id = uuid4()
    request_id = uuid4()

    await db_session.execute(
        text(
            """
            INSERT INTO audit_log (log_id, tenant_id, actor_id, action, target, status_code, request_id, ip_address, user_agent, created_at)
            VALUES (:log_id, :tenant_id, NULL, 'READ', 'ctrl-1', 200, :req_id, '127.0.0.1', 'pytest', now())
            """
        ),
        {"log_id": log_id, "tenant_id": tenant_id, "req_id": request_id},
    )
    await db_session.commit()


async def test_audit_log_raw_update_raises_error(db_session):
    """2. Raw UPDATE as grc_app_test must raise database error (permission/policy denied)."""
    tenant_id = await get_or_create_tenant(db_session)
    log_id = uuid4()
    request_id = uuid4()

    await db_session.execute(
        text(
            """
            INSERT INTO audit_log (log_id, tenant_id, actor_id, action, target, status_code, request_id, ip_address, user_agent, created_at)
            VALUES (:log_id, :tenant_id, NULL, 'READ', 'ctrl-1', 200, :req_id, '127.0.0.1', 'pytest', now())
            """
        ),
        {"log_id": log_id, "tenant_id": tenant_id, "req_id": request_id},
    )
    await db_session.commit()

    with pytest.raises((ProgrammingError, DBAPIError)):
        try:
            await db_session.execute(
                text("SELECT set_config('app.tenant_id', :tid, true)"),
                {"tid": str(tenant_id)},
            )
            await db_session.execute(
                text("UPDATE audit_log SET action = 'TAMPERED' WHERE log_id = :log_id"),
                {"log_id": log_id},
            )
            await db_session.flush()
        finally:
            await db_session.rollback()


async def test_audit_log_raw_delete_raises_error(db_session):
    """3. Raw DELETE as grc_app_test must raise database error (permission/policy denied)."""
    tenant_id = await get_or_create_tenant(db_session)
    log_id = uuid4()
    request_id = uuid4()

    await db_session.execute(
        text(
            """
            INSERT INTO audit_log (log_id, tenant_id, actor_id, action, target, status_code, request_id, ip_address, user_agent, created_at)
            VALUES (:log_id, :tenant_id, NULL, 'READ', 'ctrl-1', 200, :req_id, '127.0.0.1', 'pytest', now())
            """
        ),
        {"log_id": log_id, "tenant_id": tenant_id, "req_id": request_id},
    )
    await db_session.commit()

    with pytest.raises((ProgrammingError, DBAPIError)):
        try:
            await db_session.execute(
                text("SELECT set_config('app.tenant_id', :tid, true)"),
                {"tid": str(tenant_id)},
            )
            await db_session.execute(
                text("DELETE FROM audit_log WHERE log_id = :log_id"),
                {"log_id": log_id},
            )
            await db_session.flush()
        finally:
            await db_session.rollback()
