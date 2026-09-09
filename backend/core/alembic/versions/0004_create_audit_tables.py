"""create audit_log table with RLS and immutability hardening

Revision ID: 0004
Revises: 0003

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create table audit_log
    op.create_table(
        "audit_log",
        sa.Column("log_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.tenant_id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "actor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.user_id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("action", sa.String(length=10), nullable=False),
        sa.Column("target", sa.String(length=255), nullable=False),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            index=True,
        ),
    )

    # 2. Enable RLS
    op.execute("ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;")

    # 3. Create tenant isolation read policy
    op.execute(
        """
        CREATE POLICY tenant_isolation_audit_log_policy ON audit_log
        FOR ALL
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
        """
    )

    # 4. Enforce constraint strictly per spec
    op.execute("REVOKE UPDATE, DELETE ON TABLE audit_log FROM grc_user;")


def downgrade() -> None:
    # 1. Re-grant permissions
    op.execute("GRANT UPDATE, DELETE ON TABLE audit_log TO grc_user;")

    # 2. Drop policy
    op.execute("DROP POLICY IF EXISTS tenant_isolation_audit_log_policy ON audit_log;")

    # 3. Disable RLS
    op.execute("ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;")

    # 4. Drop table
    op.drop_table("audit_log")