# backend/core/app/db/evidence_models.py
# Author: Vikram Singh
# Issue: #B2 — Core Tenant-Scoped Schema + RLS Activation
# Task: EvidenceRequirement + Evidence models
# NOTE: Draft file — Revanth will integrate this into models.py

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID

from app.db.models import Base
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from uuid6 import uuid7

if TYPE_CHECKING:
    from app.db.models import Control


# ============================================================
# ENUM — Review Status
# ============================================================


class ReviewStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


# ============================================================
# TABLE 1: evidence_requirements
# ============================================================


class EvidenceRequirement(Base):
    """
    Defines the type and refresh cadence of evidence required
    for a particular compliance control.
    """

    __tablename__ = "evidence_requirements"

    # --------------------------------------------------------
    # Primary Key
    # --------------------------------------------------------

    requirement_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid7,
        nullable=False,
    )

    # --------------------------------------------------------
    # Foreign Key → controls
    # --------------------------------------------------------

    control_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "controls.control_id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # --------------------------------------------------------
    # Requirement Details
    # --------------------------------------------------------

    type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    cadence_days: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # --------------------------------------------------------
    # Relationships
    # --------------------------------------------------------

    # Many EvidenceRequirement → One Control
    control: Mapped[Control] = relationship(
        "Control",
        back_populates="evidence_requirements",
    )

    # One EvidenceRequirement → Many Evidence
    evidence_items: Mapped[list[Evidence]] = relationship(
        "Evidence",
        back_populates="requirement",
        cascade="all, delete-orphan",
    )


# ============================================================
# TABLE 2: evidence
# ============================================================


class Evidence(Base):
    """
    Stores metadata and storage pointers for collected evidence.

    Evidence is tenant-scoped through tenant_id and is protected
    by PostgreSQL Row-Level Security.
    """

    __tablename__ = "evidence"

    # --------------------------------------------------------
    # Primary Key
    # --------------------------------------------------------

    evidence_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid7,
        nullable=False,
    )

    # --------------------------------------------------------
    # Tenant Scoping
    # --------------------------------------------------------

    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "tenants.tenant_id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # --------------------------------------------------------
    # Foreign Key → controls
    # --------------------------------------------------------

    control_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "controls.control_id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # --------------------------------------------------------
    # Foreign Key → evidence_requirements
    # --------------------------------------------------------

    requirement_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "evidence_requirements.requirement_id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    # --------------------------------------------------------
    # Evidence Storage
    # --------------------------------------------------------

    sha256: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )

    blob_s3_key: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
    )

    # --------------------------------------------------------
    # Collection Metadata
    # --------------------------------------------------------

    collected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    connector: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    source_ref: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    artefact_type: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # --------------------------------------------------------
    # Human Review
    # --------------------------------------------------------

    reviewer: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        nullable=True,
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    review_status: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        default=ReviewStatus.pending.value,
    )

    # --------------------------------------------------------
    # Relationships
    # --------------------------------------------------------

    # Many Evidence → One Control
    control: Mapped[Control] = relationship(
        "Control",
        back_populates="evidence_items",
    )

    # Many Evidence → One EvidenceRequirement
    requirement: Mapped[EvidenceRequirement | None] = relationship(
        "EvidenceRequirement",
        back_populates="evidence_items",
    )


# ============================================================
# RELATIONSHIP TO BE ADDED BY REVANTH DURING INTEGRATION
# ============================================================

"""
Add this relationship to the existing User model in models.py:

    controls = relationship(
        "Control",
        back_populates="owner_user",
        foreign_keys="[Control.owner]",
    )


Add these relationships to the existing Control model:

    owner_user = relationship(
        "User",
        back_populates="controls",
        foreign_keys=[owner],
    )

    evidence_requirements = relationship(
        "EvidenceRequirement",
        back_populates="control",
        cascade="all, delete-orphan",
    )

    evidence_items = relationship(
        "Evidence",
        back_populates="control",
        cascade="all, delete-orphan",
    )
"""
