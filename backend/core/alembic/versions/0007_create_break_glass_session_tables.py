"""create break glass session tables

Revision ID: 0007
Revises: 0006

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.dialects.postgresql import UUID as PGUUID

# revision identifiers, used by Alembic.
revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


break_glass_status_enum = ENUM(
    "PENDING",
    "ACTIVE",
    "EXPIRED",
    "REVOKED",
    name="break_glass_status_enum",
    create_type=False,
)


def upgrade() -> None:
    break_glass_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "break_glass_sessions",
        sa.Column("session_id", PGUUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "target_tenant_id",
            PGUUID(as_uuid=True),
            sa.ForeignKey("tenants.tenant_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("requested_by", PGUUID(as_uuid=True), nullable=False),
        sa.Column("approved_by", PGUUID(as_uuid=True), nullable=True),
        sa.Column("revoked_by", PGUUID(as_uuid=True), nullable=True),
        sa.Column("ticket_ref", sa.String(length=50), nullable=False),
        sa.Column("reason", sa.String(length=500), nullable=False),
        sa.Column("duration_hours", sa.Integer, nullable=False, server_default="2"),
        sa.Column(
            "status", break_glass_status_enum, nullable=False, server_default="PENDING"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
        ),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Deliberately NOT tenant-scoped RLS — this is platform-internal data,
    # owned by CyArt staff, same category as the `tenants` table itself.
    # It should never be reachable through a customer's own tenant context.


def downgrade() -> None:
    op.drop_table("break_glass_sessions")
    break_glass_status_enum.drop(op.get_bind(), checkfirst=True)
