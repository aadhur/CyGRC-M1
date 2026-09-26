# =============================================================================
# FILE    : backend/core/tests/test_business_rules.py
# OWNER   : Vikram (sub-cases 1, 2, 5) + Manish (sub-cases 3, 4, 6)
# ISSUE   : B10 — Test Suite Implementation
# =============================================================================

import uuid

import pytest
from sqlalchemy import text

# =============================================================================
# SUB-CASE 1 : High-Risk Closure Gate
# OWNER      : Vikram
# =============================================================================


class TestHighRiskClosureGate:
    """
    A risk with inherent_risk_score >= 16 can only be closed by CISO.
    RISK_OWNER and COMPLIANCE_MANAGER must receive 403.
    """

    @pytest.fixture(autouse=True)
    def seed_high_risk(self, db_session, real_tenants):
        tenant_id = real_tenants["alpha"]["id"]
        self.risk_id = str(uuid.uuid4())

        db_session.execute(
            text("""
                INSERT INTO risks (
                    id, tenant_id, title, likelihood, impact,
                    inherent_risk_score, treatment_plan, status
                )
                VALUES (
                    :id, :tenant_id, 'High Risk Test', 4, 4, 16,
                    'Valid mitigation plan documented.', 'OPEN'
                )
            """),
            {"id": self.risk_id, "tenant_id": tenant_id},
        )
        db_session.commit()

        yield

        db_session.execute(
            text("DELETE FROM risks WHERE id = :id"), {"id": self.risk_id}
        )
        db_session.commit()

    def test_risk_owner_cannot_close_high_risk(self, risk_owner_client):
        """RISK_OWNER gets 403 on score-16 risk closure."""
        response = risk_owner_client.post(
            f"/v1/risks/{self.risk_id}/close", json={"status": "CLOSED"}
        )
        assert response.status_code == 403, (
            f"Expected 403, got {response.status_code}. Body: {response.text}"
        )
        assert "CISO sign-off" in response.json()["detail"]

    def test_compliance_manager_cannot_close_high_risk(self, compliance_manager_client):
        """COMPLIANCE_MANAGER gets 403 on score-16 risk closure."""
        response = compliance_manager_client.post(
            f"/v1/risks/{self.risk_id}/close", json={"status": "CLOSED"}
        )
        assert response.status_code == 403
        assert "CISO sign-off" in response.json()["detail"]

    def test_ciso_can_close_high_risk(self, ciso_client):
        """CISO gets 200 on score-16 risk closure."""
        response = ciso_client.post(
            f"/v1/risks/{self.risk_id}/close", json={"status": "CLOSED"}
        )
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}. Body: {response.text}"
        )


# =============================================================================
# SUB-CASE 2 : Blank Treatment Plan Rejection
# OWNER      : Vikram
# =============================================================================


class TestBlankTreatmentPlanRejection:
    """
    Cannot close a risk with empty or whitespace-only treatment_plan.
    Even CISO must receive 400 in this case.
    """

    @pytest.fixture(autouse=True)
    def seed_blank_plan_risk(self, db_session, real_tenants):
        tenant_id = real_tenants["alpha"]["id"]
        self.risk_id = str(uuid.uuid4())

        db_session.execute(
            text("""
                INSERT INTO risks (
                    id, tenant_id, title, likelihood, impact,
                    inherent_risk_score, treatment_plan, status
                )
                VALUES (
                    :id, :tenant_id, 'Blank Plan Risk', 2, 2, 4,
                    '', 'OPEN'
                )
            """),
            {"id": self.risk_id, "tenant_id": tenant_id},
        )
        db_session.commit()

        yield

        db_session.execute(
            text("DELETE FROM risks WHERE id = :id"), {"id": self.risk_id}
        )
        db_session.commit()

    def test_ciso_cannot_close_blank_treatment_plan(self, ciso_client):
        """CISO gets 400 when treatment_plan is empty string."""
        response = ciso_client.post(
            f"/v1/risks/{self.risk_id}/close", json={"status": "CLOSED"}
        )
        assert response.status_code == 400, (
            f"Expected 400, got {response.status_code}. Body: {response.text}"
        )
        assert "treatment plan" in response.json()["detail"].lower()

    def test_tenant_admin_cannot_close_blank_treatment_plan(self, tenant_admin_client):
        """TENANT_ADMIN gets 400 when treatment_plan is empty string."""
        response = tenant_admin_client.post(
            f"/v1/risks/{self.risk_id}/close", json={"status": "CLOSED"}
        )
        assert response.status_code == 400
        assert "treatment plan" in response.json()["detail"].lower()

    def test_whitespace_only_plan_also_rejected(self, ciso_client, db_session):
        """Whitespace-only treatment_plan is treated same as blank."""
        db_session.execute(
            text("UPDATE risks SET treatment_plan = '   ' WHERE id = :id"),
            {"id": self.risk_id},
        )
        db_session.commit()

        response = ciso_client.post(
            f"/v1/risks/{self.risk_id}/close", json={"status": "CLOSED"}
        )
        assert response.status_code == 400


# =============================================================================
# SUB-CASE 3 : Privilege Escalation Gate
# OWNER      : Manish
# =============================================================================


class TestPrivilegeEscalationGate:
    """
    TENANT_ADMIN cannot invite users with high-privilege roles.
    Attempting to invite TENANT_ADMIN or PLATFORM_OPERATOR must return 403.
    """

    @pytest.mark.parametrize(
        "forbidden_role",
        [
            "TENANT_ADMIN",
            "PLATFORM_OPERATOR",
        ],
    )
    def test_cannot_invite_privileged_role(self, tenant_admin_client, forbidden_role):
        response = tenant_admin_client.post(
            "/v1/users/invite",
            json={
                "email": f"test-{uuid.uuid4()}@example.com",
                "role": forbidden_role,
            },
        )
        assert response.status_code == 403, (
            f"Role '{forbidden_role}': expected 403, "
            f"got {response.status_code}. Body: {response.text}"
        )
        detail = response.json()["detail"]
        assert "Forbidden" in detail or "invite" in detail.lower(), (
            f"Wrong detail for role '{forbidden_role}': {detail}"
        )

    def test_can_invite_normal_role(self, tenant_admin_client):
        """
        Sanity check: inviting COMPLIANCE_MANAGER must NOT return 403.
        """
        response = tenant_admin_client.post(
            "/v1/users/invite",
            json={
                "email": f"normal-{uuid.uuid4()}@example.com",
                "role": "COMPLIANCE_MANAGER",
            },
        )
        assert response.status_code != 403, (
            f"TENANT_ADMIN should not be blocked from inviting "
            f"COMPLIANCE_MANAGER. Body: {response.text}"
        )


# =============================================================================
# SUB-CASE 4 : Break-Glass Separation of Duties
# OWNER      : Manish
# =============================================================================


class TestBreakGlassSeparationOfDuties:
    """
    An operator cannot approve their own break-glass request.
    A different operator can approve it.
    """

    @pytest.fixture(autouse=True)
    def create_break_glass_session(self, operator1_client):
        """Operator 1 creates the break-glass request."""
        response = operator1_client.post(
            "/v1/operators/break-glass",
            json={"reason": "Emergency access for audit review"},
        )
        assert response.status_code in (200, 201), (
            f"Failed to create break-glass session. "
            f"Status: {response.status_code}, Body: {response.text}"
        )
        self.session_id = response.json()["session_id"]

    def test_operator_cannot_approve_own_session(self, operator1_client):
        """Operator 1 self-approving must return 403."""
        response = operator1_client.post(
            f"/v1/operators/break-glass/{self.session_id}/approve"
        )
        assert response.status_code == 403, (
            f"Expected 403, got {response.status_code}. Body: {response.text}"
        )
        detail = response.json()["detail"].lower()
        assert "own" in detail or "yourself" in detail, (
            f"Wrong detail: {response.json()['detail']}"
        )

    def test_different_operator_can_approve(self, operator2_client):
        """Operator 2 approving Operator 1's session must return 200."""
        response = operator2_client.post(
            f"/v1/operators/break-glass/{self.session_id}/approve"
        )
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}. Body: {response.text}"
        )


# =============================================================================
# SUB-CASE 5 : Audit Finding Closure Prohibition
# OWNER      : Vikram
# =============================================================================


class TestAuditFindingClosureProhibition:
    """
    Findings cannot be directly closed via PATCH.
    Valid transitions (e.g. IN_REMEDIATION) must still work.
    """

    @pytest.fixture(autouse=True)
    def seed_audit_and_finding(self, db_session, real_tenants):
        tenant_id = real_tenants["alpha"]["id"]
        self.audit_id = str(uuid.uuid4())
        self.finding_id = str(uuid.uuid4())

        db_session.execute(
            text("""
                INSERT INTO audits (id, tenant_id, title, status)
                VALUES (:id, :tenant_id, 'Test Audit', 'IN_PROGRESS')
            """),
            {"id": self.audit_id, "tenant_id": tenant_id},
        )
        db_session.execute(
            text("""
                INSERT INTO audit_findings (
                    id, audit_id, tenant_id, title, status
                )
                VALUES (
                    :id, :audit_id, :tenant_id,
                    'Test Finding', 'OPEN'
                )
            """),
            {
                "id": self.finding_id,
                "audit_id": self.audit_id,
                "tenant_id": tenant_id,
            },
        )
        db_session.commit()

        yield

        # Delete child first, then parent (foreign key order)
        db_session.execute(
            text("DELETE FROM audit_findings WHERE id = :id"), {"id": self.finding_id}
        )
        db_session.execute(
            text("DELETE FROM audits WHERE id = :id"), {"id": self.audit_id}
        )
        db_session.commit()

    def test_cannot_directly_close_finding(self, tenant_admin_client):
        """PATCH with status=CLOSED must return 400."""
        response = tenant_admin_client.patch(
            f"/v1/audits/{self.audit_id}/findings/{self.finding_id}",
            json={"status": "CLOSED"},
        )
        assert response.status_code == 400, (
            f"Expected 400 Bad Request, got {response.status_code}. "
            f"Body: {response.text}"
        )
        assert "cannot be closed" in response.json()["detail"].lower(), (
            f"Wrong detail: {response.json()['detail']}"
        )

    def test_can_set_finding_to_in_remediation(self, tenant_admin_client):
        """PATCH with status=IN_REMEDIATION must return 200."""
        response = tenant_admin_client.patch(
            f"/v1/audits/{self.audit_id}/findings/{self.finding_id}",
            json={"status": "IN_REMEDIATION"},
        )
        assert response.status_code == 200, (
            f"Expected 200 OK, got {response.status_code}. Body: {response.text}"
        )


# =============================================================================
# SUB-CASE 6 : AI Draft Approval Single-Use Lifecycle
# OWNER      : Manish
# =============================================================================


class TestAIDraftApprovalLifecycle:
    """
    AI draft review token is single-use.
    First approval: 200 + control description updated in DB.
    Second approval with same token: 409 Conflict.
    """

    @pytest.fixture(autouse=True)
    def seed_ai_draft(self, db_session, real_tenants):
        tenant_id = real_tenants["alpha"]["id"]
        self.draft_id = str(uuid.uuid4())
        self.control_id = str(uuid.uuid4())
        self.review_token = str(uuid.uuid4())

        db_session.execute(
            text("""
                INSERT INTO controls (
                    id, tenant_id, title, description
                )
                VALUES (
                    :id, :tenant_id,
                    'AI Test Control', 'Original description'
                )
            """),
            {"id": self.control_id, "tenant_id": tenant_id},
        )
        db_session.execute(
            text("""
                INSERT INTO ai_drafts (
                    id, tenant_id, control_id, status,
                    review_token, drafted_output
                )
                VALUES (
                    :id, :tenant_id, :control_id, 'PENDING',
                    :review_token, 'AI generated description'
                )
            """),
            {
                "id": self.draft_id,
                "tenant_id": tenant_id,
                "control_id": self.control_id,
                "review_token": self.review_token,
            },
        )
        db_session.commit()

        yield

        db_session.execute(
            text("DELETE FROM ai_drafts WHERE id = :id"), {"id": self.draft_id}
        )
        db_session.execute(
            text("DELETE FROM controls WHERE id = :id"), {"id": self.control_id}
        )
        db_session.commit()

    def test_first_approval_succeeds_and_updates_control(self, ciso_client, db_session):
        """First POST with valid token → 200, DB description updated."""
        updated_text = "Updated description after AI review"

        response = ciso_client.post(
            f"/v1/ai/draft/{self.review_token}/approve",
            json={"edited_output": updated_text},
        )
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}. Body: {response.text}"
        )

        # Verify DB was actually updated
        result = db_session.execute(
            text("SELECT description FROM controls WHERE id = :id"),
            {"id": self.control_id},
        ).fetchone()

        assert result is not None, "Control row not found after approval"
        assert result[0] == updated_text, (
            f"Control description not updated. DB has: '{result[0]}'"
        )

    def test_second_approval_with_same_token_returns_409(self, ciso_client):
        """Second POST with same token → 409 Conflict."""
        # First approval - must succeed
        first = ciso_client.post(
            f"/v1/ai/draft/{self.review_token}/approve",
            json={"edited_output": "First approval text"},
        )
        assert first.status_code == 200, (
            f"First approval failed unexpectedly: {first.text}"
        )

        # Second approval - must conflict
        second = ciso_client.post(
            f"/v1/ai/draft/{self.review_token}/approve",
            json={"edited_output": "Attempting reuse"},
        )
        assert second.status_code == 409, (
            f"Expected 409 Conflict, got {second.status_code}. Body: {second.text}"
        )
        assert "APPROVED" in second.json()["detail"], (
            f"Wrong conflict detail: {second.json()['detail']}"
        )
