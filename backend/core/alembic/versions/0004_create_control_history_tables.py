"""create control history tables

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-09 18:42:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

control_status_enum = ENUM(
    "PASSING",
    "FAILING",
    "STALE",
    "NOT_ASSESSED",
    "IN_REMEDIATION",
    name="control_status_enum",
    create_type=False,
)


def upgrade() -> None:
    sa.Enum(
        "PASSING",
        "FAILING",
        "STALE",
        "NOT_ASSESSED",
        "IN_REMEDIATION",
        name="control_status_enum",
    ).create(op.get_bind(), checkfirst=True)
    op.create_table(
        "control_status_history",
        sa.Column(
            "history_id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column("control_id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column(
            "old_status",
            control_status_enum,
            nullable=True,
        ),
        sa.Column(
            "new_status",
            control_status_enum,
            nullable=False,
        ),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("history_id"),
        sa.ForeignKeyConstraint(
            ["control_id"], ["controls.control_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"
        ),
    )

    op.create_index(
        op.f("ix_control_status_history_control_id"),
        "control_status_history",
        ["control_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_control_status_history_tenant_id"),
        "control_status_history",
        ["tenant_id"],
        unique=False,
    )

    # 3. Enable RLS and create isolation policy using NULLIF
    op.execute("ALTER TABLE control_status_history ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE control_status_history FORCE ROW LEVEL SECURITY;")

    op.execute("""
        CREATE POLICY history_isolation ON control_status_history
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS history_isolation ON control_status_history;")
    op.execute("ALTER TABLE control_status_history NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE control_status_history DISABLE ROW LEVEL SECURITY;")

    op.drop_index(
        op.f("ix_control_status_history_tenant_id"),
        table_name="control_status_history",
    )
    op.drop_index(
        op.f("ix_control_status_history_control_id"),
        table_name="control_status_history",
    )

    op.drop_table("control_status_history")

    sa.Enum(name="control_status_enum").drop(op.get_bind(), checkfirst=True)
