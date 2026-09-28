import uuid
from datetime import datetime, timezone

import pytest
from app.db.models import (
    AIDraft,
    AIDraftStatus,
    Audit,
    AuditStatusEnum,
    BreakGlassStatus,
    Control,
    ControlStatus,
    Finding,
    FindingSeverityEnum,
    FindingStatusEnum,
    Framework,
    Risk,
    RiskStatusEnum,
    RiskTreatmentEnum,
    User,
    UserRole,
    UserStatus,
)
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.asyncio


async def create_user(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    role: str,
) -> uuid.UUID:
    user_id = uuid.uuid4()

    await db.execute(
        text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
        {"tenant_id": str(tenant_id)},
    )

    user = User(
        user_id=user_id,
        tenant_id=tenant_id,
        email=f"b10_{role.lower()}_{user_id}@example.com",
        role=getattr(UserRole, role),
        kc_user_id=str(user_id),
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    await db.commit()

    return user_id


async def create_framework(db: AsyncSession) -> Framework:
    framework = Framework(
        framework_id=uuid.uuid4(),
        code=f"B10-{uuid.uuid4().hex[:8]}",
        version="1.0",
        name="B10 Business Logic Test Framework",
    )
    db.add(framework)
    await db.commit()
    return framework


async def create_control(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    owner_id: uuid.UUID,
    framework_id: uuid.UUID,
) -> Control:
    await db.execute(
        text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
        {"tenant_id": str(tenant_id)},
    )

    control = Control(
        control_id=uuid.uuid4(),
        tenant_id=tenant_id,
        framework_id=framework_id,
        code=f"B10-{uuid.uuid4().hex[:8]}",
        title="B10 business logic control",
        description="Original control description",
        owner=owner_id,
        status=ControlStatus.NOT_ASSESSED,
    )
    db.add(control)
    await db.commit()
    return control


async def create_risk(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    likelihood: int = 2,
    impact: int = 2,
    inherent_risk_score: int = 4,
    treatment_plan: str | None = "Valid treatment plan",
) -> Risk:
    await db.execute(
        text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
        {"tenant_id": str(tenant_id)},
    )

    risk = Risk(
        risk_id=uuid.uuid4(),
        tenant_id=tenant_id,
        title="B10 business logic risk",
        description="Risk created for B10 testing",
        likelihood=likelihood,
        impact=impact,
        inherent_risk_score=inherent_risk_score,
        treatment=RiskTreatmentEnum.MITIGATE,
        treatment_plan=treatment_plan,
        status=RiskStatusEnum.OPEN,
    )
    db.add(risk)
    await db.commit()
    return risk


async def create_audit(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    framework_id: uuid.UUID,
) -> Audit:
    await db.execute(
        text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
        {"tenant_id": str(tenant_id)},
    )

    now = datetime.now(timezone.utc)
    audit = Audit(
        audit_id=uuid.uuid4(),
        tenant_id=tenant_id,
        framework_id=framework_id,
        period_start=now,
        period_end=now,
        status=AuditStatusEnum.IN_PROGRESS,
    )
    db.add(audit)
    await db.commit()
    return audit


async def create_finding(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    audit_id: uuid.UUID,
    control_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> Finding:
    await db.execute(
        text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
        {"tenant_id": str(tenant_id)},
    )

    finding = Finding(
        finding_id=uuid.uuid4(),
        tenant_id=tenant_id,
        audit_id=audit_id,
        control_id=control_id,
        severity=FindingSeverityEnum.HIGH,
        description="B10 test finding",
        recommendation="Remediate finding",
        owner=owner_id,
        status=FindingStatusEnum.OPEN,
    )
    db.add(finding)
    await db.commit()
    return finding


# =============================================================================
# 1. HIGH-RISK CLOSURE + CISO GATE
# =============================================================================


async def test_high_risk_closure_requires_ciso(
    db_session,
    client,
    make_auth_token,
    real_tenants,
):
    tenant_id = real_tenants["tenant_a"]

    risk_owner_id = await create_user(db_session, tenant_id, "RISK_OWNER")
    ciso_id = await create_user(db_session, tenant_id, "CISO")

    risk = await create_risk(
        db_session,
        tenant_id,
        likelihood=4,
        impact=4,
        inherent_risk_score=16,
        treatment_plan="Approved treatment plan",
    )

    risk_owner_token = make_auth_token(
        tenant_id=tenant_id,
        user_id=risk_owner_id,
        role="RISK_OWNER",
    )

    response = await client.post(
        f"/v1/risks/{risk.risk_id}/close",
        json={"status": "CLOSED"},
        headers={"Authorization": f"Bearer {risk_owner_token}"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == (
        "Closing a high-inherent-risk item requires CISO sign-off."
    )

    ciso_token = make_auth_token(
        tenant_id=tenant_id,
        user_id=ciso_id,
        role="CISO",
    )

    response = await client.post(
        f"/v1/risks/{risk.risk_id}/close",
        json={"status": "CLOSED"},
        headers={"Authorization": f"Bearer {ciso_token}"},
    )

    assert response.status_code == 200


# =============================================================================
# 2. BLANK / WHITESPACE TREATMENT PLAN
# =============================================================================


@pytest.mark.parametrize("role", ["CISO", "TENANT_ADMIN"])
async def test_blank_treatment_plan_rejected(
    db_session,
    client,
    make_auth_token,
    real_tenants,
    role,
):
    tenant_id = real_tenants["tenant_a"]
    user_id = await create_user(db_session, tenant_id, role)

    risk = await create_risk(
        db_session,
        tenant_id,
        likelihood=2,
        impact=2,
        inherent_risk_score=4,
        treatment_plan="   ",
    )

    token = make_auth_token(
        tenant_id=tenant_id,
        user_id=user_id,
        role=role,
    )

    response = await client.post(
        f"/v1/risks/{risk.risk_id}/close",
        json={"status": "CLOSED"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Cannot close a risk with no treatment plan."


# =============================================================================
# 3. INVITE PRIVILEGE ESCALATION
# =============================================================================


@pytest.mark.parametrize("role", ["TENANT_ADMIN", "PLATFORM_OPERATOR"])
async def test_tenant_admin_cannot_invite_privileged_roles(
    db_session,
    client,
    make_auth_token,
    real_tenants,
    role,
):
    tenant_id = real_tenants["tenant_a"]
    admin_id = real_tenants["user_a"]

    token = make_auth_token(
        tenant_id=tenant_id,
        user_id=admin_id,
        role="TENANT_ADMIN",
    )

    response = await client.post(
        "/v1/users/invite",
        json={
            "email": f"privileged-{uuid.uuid4()}@example.com",
            "password": "TestPassword123!",
            "role": role,
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Forbidden: Can't invite those roles."


# =============================================================================
# 4. BREAK-GLASS SEPARATION OF DUTIES
# =============================================================================


async def test_break_glass_requester_cannot_approve_own_request(
    db_session,
    client,
    make_auth_token,
    real_tenants,
):
    tenant_id = real_tenants["tenant_a"]

    # The current database migration does not contain PLATFORM_OPERATOR in
    # user_role_enum, so use the existing tenant users while exercising the
    # PLATFORM_OPERATOR JWT scope required by the endpoint.
    operator_1 = real_tenants["user_a"]
    operator_2 = await create_user(db_session, tenant_id, "TENANT_ADMIN")

    operator_1_token = make_auth_token(
        tenant_id=tenant_id,
        user_id=operator_1,
        role="PLATFORM_OPERATOR",
    )

    response = await client.post(
        "/v1/operators/break-glass",
        json={
            "target_tenant_id": str(tenant_id),
            "ticket_ref": "INC-90145",
            "reason": "Production support required for B10 test",
            "duration_hours": 2,
        },
        headers={"Authorization": f"Bearer {operator_1_token}"},
    )

    assert response.status_code == 201
    session_id = response.json()["session_id"]

    response = await client.post(
        f"/v1/operators/break-glass/{session_id}/approve",
        headers={"Authorization": f"Bearer {operator_1_token}"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == (
        "You cannot approve your own break-glass request."
    )

    operator_2_token = make_auth_token(
        tenant_id=tenant_id,
        user_id=operator_2,
        role="PLATFORM_OPERATOR",
    )

    response = await client.post(
        f"/v1/operators/break-glass/{session_id}/approve",
        headers={"Authorization": f"Bearer {operator_2_token}"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == BreakGlassStatus.ACTIVE.value


# =============================================================================
# 5. AUDIT FINDING CANNOT BE CLOSED HERE
# =============================================================================


async def test_audit_finding_cannot_be_closed_here(
    db_session,
    client,
    make_auth_token,
    real_tenants,
):
    tenant_id = real_tenants["tenant_a"]
    auditor_id = real_tenants["user_a"]

    framework = await create_framework(db_session)
    control = await create_control(
        db_session,
        tenant_id,
        auditor_id,
        framework.framework_id,
    )
    audit = await create_audit(
        db_session,
        tenant_id,
        framework.framework_id,
    )
    finding = await create_finding(
        db_session,
        tenant_id,
        audit.audit_id,
        control.control_id,
        auditor_id,
    )

    token = make_auth_token(
        tenant_id=tenant_id,
        user_id=auditor_id,
        role="TENANT_ADMIN",
    )

    response = await client.patch(
        f"/v1/audits/{audit.audit_id}/findings/{finding.finding_id}",
        json={"status": "CLOSED"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Finding cannot be closed here."

    response = await client.patch(
        f"/v1/audits/{audit.audit_id}/findings/{finding.finding_id}",
        json={"status": "IN_REMEDIATION"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == FindingStatusEnum.IN_REMEDIATION.value


# =============================================================================
# 6. AI DRAFT SINGLE-USE APPROVAL LIFECYCLE
# =============================================================================


async def test_ai_draft_approval_is_single_use(
    db_session,
    client,
    make_auth_token,
    real_tenants,
):
    tenant_id = real_tenants["tenant_a"]
    approver_id = real_tenants["user_a"]

    framework = await create_framework(db_session)
    control = await create_control(
        db_session,
        tenant_id,
        approver_id,
        framework.framework_id,
    )

    review_token = f"b10-review-{uuid.uuid4()}"

    await db_session.execute(
        text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
        {"tenant_id": str(tenant_id)},
    )

    draft = AIDraft(
        draft_id=uuid.uuid4(),
        tenant_id=tenant_id,
        control_id=control.control_id,
        risk_id=None,
        prompt_hash="b10-test-prompt-hash",
        output="Original AI draft",
        model="B10-test-model",
        review_token=review_token,
        status=AIDraftStatus.PENDING,
        requested_by=approver_id,
    )
    db_session.add(draft)
    await db_session.commit()

    token = make_auth_token(
        tenant_id=tenant_id,
        user_id=approver_id,
        role="TENANT_ADMIN",
    )

    response = await client.post(
        f"/v1/ai/draft/{review_token}/approve",
        json={"edited_output": "Updated text"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200

    await db_session.rollback()
    await db_session.execute(
        text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
        {"tenant_id": str(tenant_id)},
    )

    control_result = await db_session.execute(
        text("SELECT description FROM controls WHERE control_id = :control_id"),
        {"control_id": str(control.control_id)},
    )
    draft_result = await db_session.execute(
        text("SELECT status FROM ai_drafts WHERE draft_id = :draft_id"),
        {"draft_id": str(draft.draft_id)},
    )

    assert control_result.scalar_one() == "Updated text"
    assert draft_result.scalar_one() == AIDraftStatus.APPROVED.value

    response = await client.post(
        f"/v1/ai/draft/{review_token}/approve",
        json={"edited_output": "Second update"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Draft is already APPROVED, cannot approve."
