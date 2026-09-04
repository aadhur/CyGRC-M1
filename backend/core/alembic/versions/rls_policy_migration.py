"""draft row-level security activation migration"""

from collections.abc import Sequence

from alembic import op


revision: str = "rls_policy_draft"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Enable Row-Level Security
    op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY;")

    # Force Row-Level Security
    op.execute("ALTER TABLE users FORCE ROW LEVEL SECURITY;")

    # Create tenant isolation policy
    op.execute("""
        CREATE POLICY users_isolation
        ON users
        USING (
            tenant_id = current_setting('app.tenant_id')::uuid
        );
    """)


def downgrade() -> None:
    # Drop policy
    op.execute("DROP POLICY IF EXISTS users_isolation ON users;")

    # Disable RLS
    op.execute("ALTER TABLE users NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE users DISABLE ROW LEVEL SECURITY;")