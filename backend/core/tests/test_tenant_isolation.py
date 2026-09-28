import uuid
from datetime import datetime

import pytest
import pytest_asyncio
from app.db.models import (
    Audit,
    AuditStatusEnum,
    Control,
    ControlStatus,
    Evidence,
    Framework,
    Risk,
    RiskStatusEnum,
    RiskTreatmentEnum,
)
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.asyncio


# =============================================================================
# Shared helper: a framework row to satisfy Control.framework_id's FK.
# frameworks is global/no-RLS, so no tenant context needs to be set first.
# =============================================================================


@pytest_asyncio.fixture
async def test_framework(db_session: AsyncSession) -> Framework:

    short_uuid = str(uuid.uuid4())[:8]

    framework = Framework(
        framework_id=uuid.uuid4(),
        code=f"TEST-FW-{short_uuid}",
        version="1.0",
        name="Test Framework for Tenant Isolation",
    )
    db_session.add(framework)
    await db_session.flush()
    await db_session.commit()
    return framework


# =============================================================================
# Local seed helpers — each sets app.tenant_id before inserting, matching
# the pattern already used in the real_tenants fixture itself.
# =============================================================================


async def seed_control(
    db: AsyncSession, tenant_id: uuid.UUID, framework_id: uuid.UUID, owner_id: uuid.UUID
) -> Control:
    await db.execute(
        text("SELECT set_config('app.tenant_id', :t, true)"), {"t": str(tenant_id)}
    )
    control = Control(
        control_id=uuid.uuid4(),
        tenant_id=tenant_id,
        framework_id=framework_id,
        code="A.5.1",
        title="Test control",
        description="Seeded for tenant isolation test",
        owner=owner_id,
        status=ControlStatus.NOT_ASSESSED,
    )
    db.add(control)
    await db.flush()
    await db.commit()
    return control


async def seed_risk(db: AsyncSession, tenant_id: uuid.UUID) -> Risk:
    await db.execute(
        text("SELECT set_config('app.tenant_id', :t, true)"), {"t": str(tenant_id)}
    )
    risk = Risk(
        risk_id=uuid.uuid4(),
        tenant_id=tenant_id,
        title="Test risk",
        likelihood=2,
        impact=2,
        inherent_risk_score=4,
        status=RiskStatusEnum.OPEN,
        treatment=RiskTreatmentEnum.MITIGATE,
    )
    db.add(risk)
    await db.flush()
    await db.commit()
    return risk


async def seed_evidence(
    db: AsyncSession, tenant_id: uuid.UUID, control_id: uuid.UUID
) -> Evidence:
    await db.execute(
        text("SELECT set_config('app.tenant_id', :t, true)"), {"t": str(tenant_id)}
    )
    evidence = Evidence(
        evidence_id=uuid.uuid4(),
        tenant_id=tenant_id,
        control_id=control_id,
        sha256="a" * 64,
        blob_s3_key=f"tenants/{tenant_id}/evidence/test.json",
        collected_at=datetime.fromisoformat("2026-09-01T00:00:00+00:00"),
        connector="manual",
        source_ref="manual-upload",
        artefact_type="config_json",
    )
    db.add(evidence)
    await db.flush()
    await db.commit()
    return evidence


async def seed_audit(
    db: AsyncSession, tenant_id: uuid.UUID, framework_id: uuid.UUID
) -> Audit:
    await db.execute(
        text("SELECT set_config('app.tenant_id', :t, true)"), {"t": str(tenant_id)}
    )
    audit = Audit(
        audit_id=uuid.uuid4(),
        tenant_id=tenant_id,
        framework_id=framework_id,
        period_start=datetime.fromisoformat("2026-01-01T00:00:00+00:00"),
        period_end=datetime.fromisoformat("2026-12-31T00:00:00+00:00"),
        status=AuditStatusEnum.IN_PROGRESS,
    )
    db.add(audit)
    await db.flush()
    await db.commit()
    return audit


# =============================================================================
# 1. Direct DB RLS Bypass Protection
# =============================================================================


async def test_raw_sql_select_across_tenants_returns_zero_rows(
    db_session: AsyncSession, real_tenants, test_framework
):
    beta_control = await seed_control(
        db_session,
        tenant_id=real_tenants["tenant_b"],
        framework_id=test_framework.framework_id,
        owner_id=real_tenants["user_b"],
    )

    await db_session.execute(
        text("SELECT set_config('app.tenant_id', :t, true)"),
        {"t": str(real_tenants["tenant_a"])},
    )
    result = await db_session.execute(
        text("SELECT * FROM controls WHERE control_id = :cid"),
        {"cid": str(beta_control.control_id)},
    )
    rows = result.fetchall()

    assert rows == [], "RLS failed to hide another tenant's control via raw SELECT"


async def test_raw_sql_update_across_tenants_affects_zero_rows(
    db_session: AsyncSession, real_tenants, test_framework
):
    beta_control = await seed_control(
        db_session,
        tenant_id=real_tenants["tenant_b"],
        framework_id=test_framework.framework_id,
        owner_id=real_tenants["user_b"],
    )

    await db_session.execute(
        text("SELECT set_config('app.tenant_id', :t, true)"),
        {"t": str(real_tenants["tenant_a"])},
    )
    result = await db_session.execute(
        text("UPDATE controls SET title = 'TAMPERED' WHERE control_id = :cid"),
        {"cid": str(beta_control.control_id)},
    )

    assert result.rowcount == 0, "RLS failed to block cross-tenant UPDATE"


async def test_raw_sql_delete_across_tenants_affects_zero_rows(
    db_session: AsyncSession, real_tenants, test_framework
):
    beta_control = await seed_control(
        db_session,
        tenant_id=real_tenants["tenant_b"],
        framework_id=test_framework.framework_id,
        owner_id=real_tenants["user_b"],
    )

    await db_session.execute(
        text("SELECT set_config('app.tenant_id', :t, true)"),
        {"t": str(real_tenants["tenant_a"])},
    )
    result = await db_session.execute(
        text("DELETE FROM controls WHERE control_id = :cid"),
        {"cid": str(beta_control.control_id)},
    )

    assert result.rowcount == 0, "RLS failed to block cross-tenant DELETE"


# =============================================================================
# 2. API Endpoint Cross-Tenant Leakage Protection
# =============================================================================


async def test_api_get_control_cross_tenant(
    client: AsyncClient,
    db_session: AsyncSession,
    real_tenants,
    test_framework,
    make_auth_token,
):
    beta_control = await seed_control(
        db_session,
        tenant_id=real_tenants["tenant_b"],
        framework_id=test_framework.framework_id,
        owner_id=real_tenants["user_b"],
    )

    alpha_token = make_auth_token(
        tenant_id=real_tenants["tenant_a"],
        user_id=real_tenants["user_a"],
        role="TENANT_ADMIN",
    )

    response = await client.get(
        f"/v1/controls/{beta_control.control_id}",
        headers={"Authorization": f"Bearer {alpha_token}"},
    )
    assert response.status_code == 404


async def test_api_patch_control_cross_tenant(
    client: AsyncClient,
    db_session: AsyncSession,
    real_tenants,
    test_framework,
    make_auth_token,
):
    beta_control = await seed_control(
        db_session,
        tenant_id=real_tenants["tenant_b"],
        framework_id=test_framework.framework_id,
        owner_id=real_tenants["user_b"],
    )

    alpha_token = make_auth_token(
        tenant_id=real_tenants["tenant_a"],
        user_id=real_tenants["user_a"],
        role="TENANT_ADMIN",
    )

    response = await client.patch(
        f"/v1/controls/{beta_control.control_id}",
        headers={"Authorization": f"Bearer {alpha_token}"},
        json={"notes": "attempted cross-tenant edit"},
    )
    assert response.status_code == 404


async def test_api_get_risk_cross_tenant(
    client: AsyncClient, db_session: AsyncSession, real_tenants, make_auth_token
):
    beta_risk = await seed_risk(db_session, tenant_id=real_tenants["tenant_b"])

    alpha_token = make_auth_token(
        tenant_id=real_tenants["tenant_a"],
        user_id=real_tenants["user_a"],
        role="TENANT_ADMIN",
    )

    response = await client.get(
        "/v1/risks",
        headers={"Authorization": f"Bearer {alpha_token}"},
    )
    assert response.status_code == 200
    risk_ids = [r["risk_id"] for r in response.json()]
    assert str(beta_risk.risk_id) not in risk_ids


async def test_api_review_evidence_cross_tenant(
    client: AsyncClient,
    db_session: AsyncSession,
    real_tenants,
    test_framework,
    make_auth_token,
):
    beta_control = await seed_control(
        db_session,
        tenant_id=real_tenants["tenant_b"],
        framework_id=test_framework.framework_id,
        owner_id=real_tenants["user_b"],
    )
    beta_evidence = await seed_evidence(
        db_session,
        tenant_id=real_tenants["tenant_b"],
        control_id=beta_control.control_id,
    )

    alpha_token = make_auth_token(
        tenant_id=real_tenants["tenant_a"],
        user_id=real_tenants["user_a"],
        role="TENANT_ADMIN",
    )

    response = await client.post(
        f"/v1/evidence/{beta_evidence.evidence_id}/review",
        headers={"Authorization": f"Bearer {alpha_token}"},
        json={"review_status": "APPROVED"},
    )
    assert response.status_code == 404


async def test_api_get_audit_controls_cross_tenant(
    client: AsyncClient,
    db_session: AsyncSession,
    real_tenants,
    test_framework,
    make_auth_token,
):
    beta_audit = await seed_audit(
        db_session,
        tenant_id=real_tenants["tenant_b"],
        framework_id=test_framework.framework_id,
    )

    alpha_token = make_auth_token(
        tenant_id=real_tenants["tenant_a"],
        user_id=real_tenants["user_a"],
        role="TENANT_ADMIN",
    )

    response = await client.get(
        f"/v1/audits/{beta_audit.audit_id}/controls",
        headers={"Authorization": f"Bearer {alpha_token}"},
    )
    assert response.status_code == 404


# =============================================================================
# 3. Cross-Tenant Foreign Key Injection Attack
# =============================================================================


async def test_finding_creation_with_cross_tenant_control_id(
    client: AsyncClient,
    db_session: AsyncSession,
    real_tenants,
    test_framework,
    make_auth_token,
):
    """
    Tenant Alpha attempts to create a finding on their own audit, but
    supplies a control_id belonging to Tenant Beta. Must be rejected.
    """
    alpha_audit = await seed_audit(
        db_session,
        tenant_id=real_tenants["tenant_a"],
        framework_id=test_framework.framework_id,
    )
    beta_control = await seed_control(
        db_session,
        tenant_id=real_tenants["tenant_b"],
        framework_id=test_framework.framework_id,
        owner_id=real_tenants["user_b"],
    )

    alpha_token = make_auth_token(
        tenant_id=real_tenants["tenant_a"],
        user_id=real_tenants["user_a"],
        role="TENANT_ADMIN",
    )

    response = await client.post(
        f"/v1/audits/{alpha_audit.audit_id}/findings",
        headers={"Authorization": f"Bearer {alpha_token}"},
        json={
            "control_id": str(beta_control.control_id),
            "severity": "HIGH",
            "description": "Injected cross-tenant control reference",
            "recommendation": "Implement strict row isolation checks.",
            "owner": str(real_tenants["user_a"]),
            "due_date": "2026-12-31T00:00:00+00:00",
        },
    )
    assert response.status_code == 404
    assert "not found or is not part of this audit" in response.json()["detail"].lower()
