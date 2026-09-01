# NOTE: This is a DRAFT file. Revanth (Step 4) will merge this into models.py

"""
DRAFT MODELS — EvidenceRequirement & Evidence
These will be integrated into models.py by Revanth during migration assembly.

Also defined here:
- Back-populating relationship on User → controls (to be added in models.py)
"""

import uuid

from sqlalchemy import (
    TIMESTAMP,
    VARCHAR,
    Column,
    ForeignKey,
    Integer,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

# ─────────────────────────────────────────────────────────
# NOTE for Revanth:
# Import Base from wherever it's declared in models.py
# e.g. from backend.core.app.db.models import Base
# For now we show it standalone for clarity
# ─────────────────────────────────────────────────────────
# from sqlalchemy.orm import DeclarativeBase
# class Base(DeclarativeBase): pass
# (Remove above when integrating — use the existing Base from models.py)


# ═══════════════════════════════════════════════════════════
# TABLE 1: evidence_requirements
# Maps what kind of evidence is needed per control
# No tenant_id here — it's a definition table per control
# ═══════════════════════════════════════════════════════════
class EvidenceRequirement:
    """
    Stores the requirement/definition of what evidence
    a particular control needs, and how often.

    Columns:
    - requirement_id : UUID PK
    - control_id     : UUID FK → controls.control_id
    - type           : VARCHAR (e.g., 'document', 'screenshot', 'config')
    - cadence_days   : INTEGER (how often evidence must be refreshed)
    - description    : TEXT (details of what's needed)
    """

    __tablename__ = "evidence_requirements"

    requirement_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,  # UUID v4 used here; swap to uuid7 if lib available
        nullable=False,
        comment="Primary key — unique requirement identifier",
    )

    control_id = Column(
        UUID(as_uuid=True),
        ForeignKey("controls.control_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Which control this requirement belongs to",
    )

    type = Column(
        VARCHAR(100),
        nullable=False,
        comment="Evidence type: document, screenshot, config_json, etc.",
    )

    cadence_days = Column(
        Integer,
        nullable=True,
        comment="How many days before this evidence expires and needs refresh",
    )

    description = Column(
        Text,
        nullable=True,
        comment="Human-readable description of what evidence is needed",
    )

    # ── Relationships ──────────────────────────────────────
    # One EvidenceRequirement → one Control (many-to-one)
    control = relationship(
        "Control",
        back_populates="evidence_requirements",
        comment="Parent control this requirement is attached to",
    )

    # One EvidenceRequirement → many Evidence rows
    evidence_items = relationship(
        "Evidence",
        back_populates="requirement",
        cascade="all, delete-orphan",
        comment="All evidence collected against this requirement",
    )


# ═══════════════════════════════════════════════════════════
# TABLE 2: evidence
# Actual collected evidence records (files, configs, etc.)
# RLS ENFORCED via tenant_id
# ═══════════════════════════════════════════════════════════
class Evidence:
    """
    Stores pointers to actual collected evidence blobs.
    Each row = one piece of evidence collected for one control.

    RLS Policy: evidence_isolation
    USING (tenant_id = current_setting('app.tenant_id')::uuid)

    Columns:
    - evidence_id    : UUID PK
    - tenant_id      : UUID FK → tenants.tenant_id  [RLS enforced]
    - control_id     : UUID FK → controls.control_id
    - requirement_id : UUID FK → evidence_requirements.requirement_id
    - sha256         : VARCHAR (integrity hash of the blob)
    - blob_s3_key    : VARCHAR (S3/MinIO path)
    - collected_at   : TIMESTAMPTZ
    - connector      : TEXT (which collector job fetched it)
    - source_ref     : TEXT (target cloud resource, e.g. aws::bucket::my-bucket)
    - artefact_type  : TEXT (config_json, pdf, screenshot)
    - expires_at     : TIMESTAMPTZ (triggers staleness scans)
    - reviewer       : UUID (human auditor user_id)
    - reviewed_at    : TIMESTAMPTZ
    - review_status  : TEXT (pending, approved, rejected)
    """

    __tablename__ = "evidence"

    # ── Primary Key ────────────────────────────────────────
    evidence_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
        comment="Primary key — unique evidence record identifier",
    )

    # ── Tenant Scoping (RLS target column) ─────────────────
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.tenant_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Tenant this evidence belongs to — RLS enforced on this column",
    )

    # ── Foreign Keys ───────────────────────────────────────
    control_id = Column(
        UUID(as_uuid=True),
        ForeignKey("controls.control_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Which control this evidence is collected for",
    )

    requirement_id = Column(
        UUID(as_uuid=True),
        ForeignKey("evidence_requirements.requirement_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Which specific requirement this evidence satisfies",
    )

    # ── Blob / Storage ────────────────────────────────────
    sha256 = Column(
        VARCHAR(64),  # SHA-256 is always 64 hex chars
        nullable=True,
        comment="SHA-256 hash of the raw blob for integrity verification",
    )

    blob_s3_key = Column(
        VARCHAR(512),
        nullable=True,
        comment="S3/MinIO object key: tenants/{tenant_id}/evidence/{id}.json",
    )

    # ── Collection Metadata ───────────────────────────────
    collected_at = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="When this evidence was collected/uploaded",
    )

    connector = Column(
        Text,
        nullable=True,
        comment="Which collector job/integration fetched this evidence",
    )

    source_ref = Column(
        Text,
        nullable=True,
        comment="Target cloud resource reference e.g. aws::bucket::my-bucket",
    )

    artefact_type = Column(
        Text,
        nullable=True,
        comment="Type of artefact: config_json, pdf, screenshot, etc.",
    )

    expires_at = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="When this evidence expires — triggers staleness scan",
    )

    # ── Human Review ──────────────────────────────────────
    reviewer = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="SET NULL"),
        nullable=True,
        comment="user_id of the human auditor who reviewed this evidence",
    )

    reviewed_at = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="When the human review was completed",
    )

    review_status = Column(
        Text,
        nullable=True,
        default="pending",
        comment="Review state: pending | approved | rejected",
    )

    # ── Relationships ──────────────────────────────────────
    # Many Evidence → one Control
    control = relationship(
        "Control",
        back_populates="evidence_items",
        comment="The control this evidence is attached to",
    )

    # Many Evidence → one EvidenceRequirement
    requirement = relationship(
        "EvidenceRequirement",
        back_populates="evidence_items",
        comment="The specific requirement this evidence satisfies",
    )
