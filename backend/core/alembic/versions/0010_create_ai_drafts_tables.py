"""create ai drafts table

Revision ID: 0010
Revises: 0009
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    ai_draft_status_enum = postgresql.ENUM(
        "PENDING",
        "APPROVED",
        "REJECTED",
        name="ai_draft_status_enum",
    )
    ai_draft_status_enum.create(
        op.get_bind(),
        checkfirst=True,
    )

    op.create_table(
        "ai_drafts",
        sa.Column(
            "draft_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "control_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "prompt_hash",
            sa.String(),
            nullable=False,
        ),
        sa.Column(
            "output",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "model",
            sa.String(),
            nullable=False,
        ),
        sa.Column(
            "review_token",
            sa.String(),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "PENDING",
                "APPROVED",
                "REJECTED",
                name="ai_draft_status_enum",
                create_type=False,
            ),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column(
            "requested_by",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "reviewed_by",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "reviewed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.tenant_id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["control_id"],
            ["controls.control_id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("draft_id"),
        sa.UniqueConstraint("review_token"),
    )

    op.create_index(
        "ix_ai_drafts_tenant_id",
        "ai_drafts",
        ["tenant_id"],
    )

    op.create_index(
        "ix_ai_drafts_control_id",
        "ai_drafts",
        ["control_id"],
    )

    op.create_index(
        "ix_ai_drafts_review_token",
        "ai_drafts",
        ["review_token"],
    )

    # Enable Row Level Security.
    op.execute("ALTER TABLE ai_drafts ENABLE ROW LEVEL SECURITY")

    # Tenant isolation.
    op.execute(
        """
        CREATE POLICY ai_drafts_tenant_isolation ON ai_drafts FOR ALL
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS ai_drafts_tenant_isolation ON ai_drafts")
    op.execute("ALTER TABLE ai_drafts NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE ai_drafts DISABLE ROW LEVEL SECURITY;")

    op.drop_index(
        "ix_ai_drafts_review_token",
        table_name="ai_drafts",
    )

    op.drop_index(
        "ix_ai_drafts_control_id",
        table_name="ai_drafts",
    )

    op.drop_index(
        "ix_ai_drafts_tenant_id",
        table_name="ai_drafts",
    )

    op.drop_table("ai_drafts")

    ai_draft_status_enum = postgresql.ENUM(
        "PENDING",
        "APPROVED",
        "REJECTED",
        name="ai_draft_status_enum",
    )
    ai_draft_status_enum.drop(
        op.get_bind(),
        checkfirst=True,
    )
