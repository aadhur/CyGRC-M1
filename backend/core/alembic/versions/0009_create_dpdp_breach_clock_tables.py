"""create dpdp breach clock

Revision ID: 0009
Revises: <previous_revision>
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    breach_clock_status_enum = postgresql.ENUM(
        "INACTIVE",
        "ACTIVE",
        "RESOLVED",
        name="breach_clock_status_enum",
    )
    breach_clock_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "dpdp_breach_clock",
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.tenant_id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "acknowledged_by",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "INACTIVE",
                "ACTIVE",
                "RESOLVED",
                name="breach_clock_status_enum",
                create_type=False,
            ),
            nullable=False,
            server_default="INACTIVE",
        ),
        sa.Column(
            "notified_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # 2. Enable RLS
    op.execute("ALTER TABLE dpdp_breach_clock ENABLE ROW LEVEL SECURITY;")

    # 3. Create tenant isolation read policy
    op.execute(
        """
        CREATE POLICY tenant_isolation_dpdp_breach_clock_policy ON dpdp_breach_clock
        FOR ALL
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
        """
    )


def downgrade() -> None:
    op.execute(
        "DROP POLICY IF EXISTS tenant_isolation_dpdp_breach_clock_policy ON dpdp_breach_clock;"
    )
    op.execute("ALTER TABLE dpdp_breach_clock NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE dpdp_breach_clock DISABLE ROW LEVEL SECURITY;")

    op.drop_table("dpdp_breach_clock")

    breach_clock_status_enum = postgresql.ENUM(
        "INACTIVE",
        "ACTIVE",
        "RESOLVED",
        name="breach_clock_status_enum",
    )
    breach_clock_status_enum.drop(op.get_bind(), checkfirst=True)
