"""seed master catalog frameworks

Revision ID: 0003_seed_master_frameworks
Revises: 0002_create_compliance_tables

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from uuid6 import uuid7

revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    connection = op.get_bind()

    frameworks_helper = sa.table(
        "frameworks",
        sa.column("framework_id", sa.UUID),
        sa.column("code", sa.String),
        sa.column("version", sa.String),
        sa.column("name", sa.String),
    )

    connection.execute(
        frameworks_helper.insert().values(
            [
                {
                    "framework_id": uuid7(),
                    "code": "ISO27001:2022",
                    "version": "2022",
                    "name": "ISO/IEC 27001:2022 Information Security",
                },
                {
                    "framework_id": uuid7(),
                    "code": "NIST-CSF:2.0",
                    "version": "2.0",
                    "name": "NIST Cybersecurity Framework 2.0",
                },
                {
                    "framework_id": uuid7(),
                    "code": "PCI-DSS:4.0.1",
                    "version": "4.0.1",
                    "name": "PCI Data Security Standard 4.0.1",
                },
                {
                    "framework_id": uuid7(),
                    "code": "DPDP:2023",
                    "version": "2023",
                    "name": "Digital Personal Data Protection Act (DPDP) 2023",
                },
                {
                    "framework_id": uuid7(),
                    "code": "CERT-In:2022",
                    "version": "2022",
                    "name": "CERT-In Cybersecurity Directions 2022",
                },
                {
                    "framework_id": uuid7(),
                    "code": "SOC2:2017",
                    "version": "2017",
                    "name": "SOC 2 Trust Services Criteria 2017",
                },
            ]
        )
    )


def downgrade() -> None:
    connection = op.get_bind()
    connection.execute(sa.text("TRUNCATE TABLE frameworks CASCADE;"))
