"""draft row-level security activation migration"""

from collections.abc import Sequence

from alembic import op


revision: str = "rls_policy_draft"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Enable Row-Level Security
    op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE controls ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;")

    # Force Row-Level Security
    op.execute("ALTER TABLE users FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE controls FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE evidence FORCE ROW LEVEL SECURITY;")

    # Create tenant isolation policies
    op.execute("""
        CREATE POLICY users_isolation
        ON users
        USING (
            tenant_id = current_setting('app.current_tenant_id')::uuid
        );
    """)

    op.execute("""
        CREATE POLICY controls_isolation
        ON controls
        USING (
            tenant_id = current_setting('app.current_tenant_id')::uuid
        );
    """)

    op.execute("""
        CREATE POLICY evidence_isolation
        ON evidence
        USING (
            tenant_id = current_setting('app.current_tenant_id')::uuid
        );
    """)


def downgrade() -> None:
    # Drop policies
    op.execute("DROP POLICY IF EXISTS evidence_isolation ON evidence;")
    op.execute("DROP POLICY IF EXISTS controls_isolation ON controls;")
    op.execute("DROP POLICY IF EXISTS users_isolation ON users;")

    # Disable RLS in reverse order
    op.execute("ALTER TABLE evidence NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE evidence DISABLE ROW LEVEL SECURITY;")

    op.execute("ALTER TABLE controls NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE controls DISABLE ROW LEVEL SECURITY;")

    op.execute("ALTER TABLE users NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE users DISABLE ROW LEVEL SECURITY;")