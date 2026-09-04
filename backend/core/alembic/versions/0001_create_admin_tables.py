"""create admin tables

Revision ID: 0001
Revises:
Create Date: 2026-08-26 13:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM, UUID

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Set create_type=False so create_table doesn't re-attempt to CREATE TYPE
tenant_status_enum = ENUM(
    "provisioning", "active", "deleting", name="tenant_status_enum", create_type=False
)
user_status_enum = ENUM(
    "active", "suspended", name="user_status_enum", create_type=False
)
user_role_enum = ENUM("admin", "user", name="user_role", create_type=False)


def upgrade() -> None:
    # 1. Explicitly create the ENUM types in PostgreSQL
    sa.Enum("provisioning", "active", "deleting", name="tenant_status_enum").create(
        op.get_bind(), checkfirst=True
    )
    sa.Enum("active", "suspended", name="user_status_enum").create(
        op.get_bind(), checkfirst=True
    )
    sa.Enum("admin", "user", name="user_role").create(op.get_bind(), checkfirst=True)

    # 2. Create tenants table
    op.create_table(
        "tenants",
        sa.Column("tenant_id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "status", tenant_status_enum, nullable=False, server_default="provisioning"
        ),
        sa.Column("plan", sa.String(length=100), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # 3. Create users table
    op.create_table(
        "users",
        sa.Column("user_id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.tenant_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("status", user_status_enum, nullable=False, server_default="active"),
        sa.Column("role", user_role_enum, nullable=False, server_default="user"),
        sa.Column("sso_subject", sa.String(length=255), nullable=True),
    )

    # 4. Create foreign key index
    op.create_index("ix_users_tenant_id", "users", ["tenant_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_users_tenant_id", table_name="users")
    op.drop_table("users")
    op.drop_table("tenants")
    sa.Enum(name="user_role").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="user_status_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="tenant_status_enum").drop(op.get_bind(), checkfirst=True)
