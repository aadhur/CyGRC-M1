import pytest
from app.db.models import Tenant, User, UserRole, UserStatus
from app.middleware.auth import ROLE_SCOPES
from httpx import AsyncClient
from sqlalchemy import text
from uuid6 import uuid7

PROTECTED_ENDPOINTS = [
    # Controls
    ("GET", "/v1/controls", "controls:read"),
    ("POST", "/v1/controls/calculate", "controls:write"),
    ("GET", "/v1/controls/{control_id}", "controls:read"),
    ("PATCH", "/v1/controls/{control_id}", "controls:write"),
    ("GET", "/v1/controls/{control_id}/evidence", "evidence:read"),
    ("GET", "/v1/controls/assignees", "controls:read"),
    # Frameworks
    ("GET", "/v1/frameworks", "frameworks:read"),
    ("POST", "/v1/frameworks", "frameworks:write"),
    # Evidence
    ("POST", "/v1/evidence", "evidence:write"),
    ("POST", "/v1/evidence/{evidence_id}/review", "evidence:review"),
    # Risks
    ("GET", "/v1/risks", "risks:read"),
    ("POST", "/v1/risks", "risks:write"),
    ("PATCH", "/v1/risks/{risk_id}", "risks:write"),
    ("GET", "/v1/risks/{risk_id}", "risks:read"),
    ("POST", "/v1/risks/{risk_id}/close", "risks:close"),
    # Audits
    ("GET", "/v1/audits", "audits:read"),
    ("POST", "/v1/audits", "audits:write"),
    ("GET", "/v1/audits/{audit_id}", "audits:read"),
    ("GET", "/v1/audits/{audit_id}/controls", "audits:read"),
    ("POST", "/v1/audits/{audit_id}/controls/{control_id}/review", "audits:write"),
    ("POST", "/v1/audits/{audit_id}/findings", "audits:write"),
    ("GET", "/v1/audits/{audit_id}/findings", "audits:read"),
    ("PATCH", "/v1/audits/{audit_id}/findings/{finding_id}", "audits:write"),
    ("POST", "/v1/audits/{audit_id}/sign-off", "audits:write"),
    ("POST", "/v1/audits/{audit_id}/export", "audits:export"),
    # Audit Log
    ("GET", "/v1/audit-log", "auditlog:read"),
    # Users
    ("GET", "/v1/users", "users:read"),
    ("POST", "/v1/users/invite", "users:write"),
    ("DELETE", "/v1/users/{user_id}", "users:delete"),
    # DPDP
    ("GET", "/v1/dpdp/breach-clock", "dpdp:read"),
    ("POST", "/v1/dpdp/breach-clock/start", "dpdp:write"),
    ("POST", "/v1/dpdp/breach-clock/resolve", "dpdp:write"),
    # AI / SLM Drafting
    ("POST", "/v1/ai/draft/control", "ai:draft"),
    ("POST", "/v1/ai/draft/risk", "ai:draft"),
    ("POST", "/v1/ai/draft/{token}/approve", "ai:approve"),
    # Platform Operator
    ("GET", "/v1/operators/tenants", "operator:admin"),
    ("POST", "/v1/operators/break-glass", "operator:break-glass"),
    ("POST", "/v1/operators/break-glass/{session_id}/approve", "operator:break-glass"),
    ("POST", "/v1/operators/break-glass/{session_id}/revoke", "operator:break-glass"),
    ("GET", "/v1/operators/break-glass", "operator:admin"),
]

ALL_SYSTEM_ROLES = list(ROLE_SCOPES.keys())


@pytest.mark.asyncio
@pytest.mark.parametrize("method,route_tmpl,required_scope", PROTECTED_ENDPOINTS)
@pytest.mark.parametrize("role", ALL_SYSTEM_ROLES)
async def test_all_endpoints_scope_enforcement_matrix(
    client: AsyncClient,
    make_auth_token,
    db_session,
    method: str,
    route_tmpl: str,
    required_scope: str,
    role: str,
):
    tenant_id = uuid7()
    user_id = uuid7()

    if role != "PLATFORM_OPERATOR":
        # 1. Create the tenant first to satisfy FK constraint
        tenant = Tenant(
            tenant_id=tenant_id,
            name=f"Tenant-{tenant_id}",
            plan="ENTERPRISE",
        )
        db_session.add(tenant)
        await db_session.flush()

        # 2. Set RLS context
        await db_session.execute(
            text("SELECT set_config('app.tenant_id', :t, true)"),
            {"t": str(tenant_id)},
        )

        # 3. Create the user
        user = User(
            user_id=user_id,
            tenant_id=tenant_id,
            email=f"perm_{role.lower()}_{user_id}@example.com",
            role=getattr(UserRole, role),
            kc_user_id=str(user_id),
            status=UserStatus.ACTIVE,
        )
        db_session.add(user)
        await db_session.commit()

    token = make_auth_token(tenant_id=tenant_id, user_id=user_id, role=role)
    headers = {"Authorization": f"Bearer {token}"}

    # Format route path placeholders
    route = (
        route_tmpl.replace("{id}", str(uuid7()))
        .replace("{control_id}", str(uuid7()))
        .replace("{evidence_id}", str(uuid7()))
        .replace("{risk_id}", str(uuid7()))
        .replace("{audit_id}", str(uuid7()))
        .replace("{finding_id}", str(uuid7()))
        .replace("{user_id}", str(uuid7()))
        .replace("{session_id}", str(uuid7()))
        .replace("{token}", "dummy_token_32_characters_12345")
    )

    if method == "GET":
        resp = await client.get(route, headers=headers)
    elif method == "POST":
        resp = await client.post(route, json={}, headers=headers)
    elif method == "PATCH":
        resp = await client.patch(route, json={}, headers=headers)
    elif method == "DELETE":
        resp = await client.delete(route, headers=headers)

    has_scope = required_scope in ROLE_SCOPES[role]

    if has_scope:
        assert resp.status_code != 403, (
            f"RBAC REGRESSION: Role '{role}' possesses required scope '{required_scope}' "
            f"for {method} {route}, but received 403 Forbidden: {resp.text}"
        )
    else:
        assert resp.status_code == 403, (
            f"SECURITY BREACH: Role '{role}' lacks scope '{required_scope}' "
            f"for {method} {route}, but received {resp.status_code} instead of 403!"
        )
