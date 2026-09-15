"""create risk tables

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-09 18:44:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM

# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

risk_treatment_enum = ENUM(
    "AVOID",
    "MITIGATE",
    "TRANSFER",
    "ACCEPT",
    name="risk_treatment_enum",
    create_type=False,
)
risk_status_enum = ENUM(
    "OPEN",
    "TREATING",
    "CLOSED",
    "ACCEPTED",
    name="risk_status_enum",
    create_type=False,
)


def upgrade() -> None:

    sa.Enum(
        "AVOID",
        "MITIGATE",
        "TRANSFER",
        "ACCEPT",
        name="risk_treatment_enum",
    ).create(op.get_bind(), checkfirst=True)

    sa.Enum(
        "OPEN",
        "TREATING",
        "CLOSED",
        "ACCEPTED",
        name="risk_status_enum",
    ).create(op.get_bind(), checkfirst=True)

    # 2. Create 'risks' Table
    op.create_table(
        "risks",
        sa.Column(
            "risk_id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("likelihood", sa.Integer(), nullable=False),
        sa.Column("impact", sa.Integer(), nullable=False),
        sa.Column("inherent_risk_score", sa.Integer(), nullable=False),
        sa.Column("residual_risk_score", sa.Integer(), nullable=True),
        sa.Column(
            "treatment",
            risk_treatment_enum,
            nullable=False,
        ),
        sa.Column("treatment_plan", sa.Text(), nullable=True),
        sa.Column("target_close_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status",
            risk_status_enum,
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("risk_id"),
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"
        ),
        sa.CheckConstraint(
            "likelihood >= 1 AND likelihood <= 5", name="check_likelihood_range"
        ),
        sa.CheckConstraint("impact >= 1 AND impact <= 5", name="check_impact_range"),
    )

    op.create_table(
        "risk_controls",
        sa.Column(
            "tenant_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("tenants.tenant_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("risk_id", sa.UUID(), nullable=False),
        sa.Column("control_id", sa.UUID(), nullable=False),
        sa.PrimaryKeyConstraint("risk_id", "control_id"),
        sa.ForeignKeyConstraint(["risk_id"], ["risks.risk_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["control_id"], ["controls.control_id"], ondelete="CASCADE"
        ),
    )
    op.create_index(op.f("ix_risks_tenant_id"), "risks", ["tenant_id"], unique=False)
    op.create_index(
        op.f("ix_risk_controls_control_id"),
        "risk_controls",
        ["control_id"],
        unique=False,
    )

    # 4. Enable RLS & Apply Isolation Policy on 'risks'
    op.execute("ALTER TABLE risks ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE risks FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY risks_isolation ON risks
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
    """)
    # 5. Enable RLS & Apply Isolation Policy on 'risk_controls'
    op.execute("ALTER TABLE risk_controls ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE risk_controls FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY risks_controls_isolation ON risk_controls
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS risks_isolation ON risks;")
    op.execute("ALTER TABLE risks NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE risks DISABLE ROW LEVEL SECURITY;")

    op.execute("DROP POLICY IF EXISTS risks_controls_isolation ON risk_controls;")
    op.execute("ALTER TABLE risk_controls NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE risk_controls DISABLE ROW LEVEL SECURITY;")

    op.drop_index(op.f("ix_risk_controls_control_id"), table_name="risk_controls")
    op.drop_index(op.f("ix_risks_tenant_id"), table_name="risks")

    op.drop_table("risk_controls")
    op.drop_table("risks")

    sa.Enum(name="risk_treatment_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="risk_status_enum").drop(op.get_bind(), checkfirst=True)
