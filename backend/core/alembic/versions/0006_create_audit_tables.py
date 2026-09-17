"""create audit tables

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-09 21:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM

# revision identifiers, used by Alembic.
revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

audit_status_enum = ENUM(
    "PLANNING",
    "IN_PROGRESS",
    "REMEDIATION",
    "CLOSED",
    name="audit_status_enum",
    create_type=False,
)
audit_verdict_enum = ENUM(
    "PASS",
    "FAIL",
    "EXCEPTION",
    name="audit_verdict_enum",
    create_type=False,
)
finding_severity_enum = ENUM(
    "CRITICAL",
    "HIGH",
    "MEDIUM",
    "LOW",
    name="finding_severity_enum",
    create_type=False,
)
finding_status_enum = ENUM(
    "OPEN",
    "IN_REMEDIATION",
    "CLOSED",
    name="finding_status_enum",
    create_type=False,
)


def upgrade() -> None:
    # 1. Create Enum Types
    sa.Enum(
        "PLANNING",
        "IN_PROGRESS",
        "REMEDIATION",
        "CLOSED",
        name="audit_status_enum",
    ).create(op.get_bind(), checkfirst=True)
    sa.Enum(
        "PASS", "FAIL", "EXCEPTION", name="audit_verdict_enum", create_type=False
    ).create(op.get_bind(), checkfirst=True)

    sa.Enum(
        "CRITICAL",
        "HIGH",
        "MEDIUM",
        "LOW",
        name="finding_severity_enum",
    ).create(op.get_bind(), checkfirst=True)

    sa.Enum(
        "OPEN",
        "IN_REMEDIATION",
        "CLOSED",
        name="finding_status_enum",
    ).create(op.get_bind(), checkfirst=True)

    # 2. Create 'audits' Table
    op.create_table(
        "audits",
        sa.Column(
            "audit_id",
            sa.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("tenant_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("framework_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", audit_status_enum, nullable=False),
        sa.Column("signed_off_by", sa.UUID(as_uuid=True), nullable=True),
        sa.PrimaryKeyConstraint("audit_id"),
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["framework_id"], ["frameworks.framework_id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["signed_off_by"], ["users.user_id"], ondelete="SET NULL"
        ),
    )

    # 3. Create 'audit_scope_controls' Bridge Table
    op.create_table(
        "audit_scope_controls",
        sa.Column(
            "tenant_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("tenants.tenant_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("audit_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("control_id", sa.UUID(as_uuid=True), nullable=False),
        sa.PrimaryKeyConstraint("audit_id", "control_id"),
        sa.ForeignKeyConstraint(["audit_id"], ["audits.audit_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["control_id"], ["controls.control_id"], ondelete="CASCADE"
        ),
    )

    # 4. Create 'audit_control_reviews' Table
    op.create_table(
        "audit_control_reviews",
        sa.Column(
            "tenant_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("tenants.tenant_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("audit_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("control_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("verdict", audit_verdict_enum, nullable=False),
        sa.Column("reviewed_by", sa.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "reviewed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("audit_id", "control_id"),
        sa.ForeignKeyConstraint(["audit_id"], ["audits.audit_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["control_id"], ["controls.control_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by"], ["users.user_id"], ondelete="RESTRICT"
        ),
    )

    # 5. Create 'findings' Table
    op.create_table(
        "findings",
        sa.Column(
            "finding_id",
            sa.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("tenant_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("audit_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("control_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("severity", finding_severity_enum, nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("recommendation", sa.Text(), nullable=True),
        sa.Column("owner", sa.UUID(as_uuid=True), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", finding_status_enum, nullable=False),
        sa.PrimaryKeyConstraint("finding_id"),
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["audit_id"], ["audits.audit_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["control_id"], ["controls.control_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["owner"], ["users.user_id"], ondelete="SET NULL"),
    )

    # 6. Create Indexes for Performance & RLS
    op.create_index(op.f("ix_audits_tenant_id"), "audits", ["tenant_id"], unique=False)
    op.create_index(
        op.f("ix_audits_framework_id"), "audits", ["framework_id"], unique=False
    )
    op.create_index(
        op.f("ix_audit_scope_controls_control_id"),
        "audit_scope_controls",
        ["control_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_audit_control_reviews_control_id"),
        "audit_control_reviews",
        ["control_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_findings_tenant_id"), "findings", ["tenant_id"], unique=False
    )
    op.create_index(
        op.f("ix_findings_audit_id"), "findings", ["audit_id"], unique=False
    )
    op.create_index(
        op.f("ix_findings_control_id"), "findings", ["control_id"], unique=False
    )

    # 7. Enable RLS and Tenant Isolation Policies
    op.execute("ALTER TABLE audits ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE audits FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY audits_isolation ON audits
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
    """)

    op.execute("ALTER TABLE findings ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE findings FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY findings_isolation ON findings
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
    """)

    op.execute("ALTER TABLE audit_scope_controls ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE audit_scope_controls FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY audit_scope_controls_isolation ON audit_scope_controls
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
    """)

    op.execute("ALTER TABLE audit_control_reviews ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE audit_control_reviews FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY audit_control_reviews_isolation ON audit_control_reviews
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
    """)


def downgrade() -> None:
    # Drop policies and disable RLS
    op.execute("DROP POLICY IF EXISTS findings_isolation ON findings;")
    op.execute("ALTER TABLE findings NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE findings DISABLE ROW LEVEL SECURITY;")

    op.execute("DROP POLICY IF EXISTS audits_isolation ON audits;")
    op.execute("ALTER TABLE audits NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE audits DISABLE ROW LEVEL SECURITY;")

    op.execute(
        "DROP POLICY IF EXISTS audit_scope_controls_isolation ON audit_scope_controls;"
    )
    op.execute("ALTER TABLE audit_scope_controls NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE audit_scope_controls DISABLE ROW LEVEL SECURITY;")

    op.execute(
        "DROP POLICY IF EXISTS audit_control_reviews_isolation ON audit_control_reviews;"
    )
    op.execute("ALTER TABLE audit_control_reviews NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE audit_control_reviews DISABLE ROW LEVEL SECURITY;")

    # Drop indexes
    op.drop_index(op.f("ix_findings_control_id"), table_name="findings")
    op.drop_index(op.f("ix_findings_audit_id"), table_name="findings")
    op.drop_index(op.f("ix_findings_tenant_id"), table_name="findings")
    op.drop_index(
        op.f("ix_audit_control_reviews_control_id"),
        table_name="audit_control_reviews",
    )
    op.drop_index(
        op.f("ix_audit_scope_controls_control_id"),
        table_name="audit_scope_controls",
    )
    op.drop_index(op.f("ix_audits_framework_id"), table_name="audits")
    op.drop_index(op.f("ix_audits_tenant_id"), table_name="audits")

    # Drop tables
    op.drop_table("findings")
    op.drop_table("audit_control_reviews")
    op.drop_table("audit_scope_controls")
    op.drop_table("audits")

    # Drop Enum types
    sa.Enum(name="finding_status_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="finding_severity_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="audit_verdict_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="audit_status_enum").drop(op.get_bind(), checkfirst=True)
