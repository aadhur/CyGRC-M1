# ADDITIONS TO backend/core/app/db/models.py FOR ISSUE #B2
# Integrated from: framework_control_models.py + evidence_models.py
# Changes:
# 1. Add Text, Integer imports on sqlalchemy
# 2. Add framework, control, evidence and evidence_requirements models
# 3. Establish relationships between Users, Control and Evidence
# 4. Removed some comments for a cleaner look


from datetime import datetime, timezone
from enum import Enum
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from uuid6 import uuid7


class Base(DeclarativeBase):
    pass


class TenantStatus(str, Enum):
    provisioning = "provisioning"
    active = "active"
    deleting = "deleting"


class Tenant(Base):
    __tablename__ = "tenants"

    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid7,
    )

    name: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    status: Mapped[TenantStatus] = mapped_column(
        SQLEnum(TenantStatus, name="tenant_status_enum"),
        nullable=False,
        default=TenantStatus.provisioning,
    )

    plan: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    users: Mapped[list["User"]] = relationship(
        "User",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )


class UserStatus(str, Enum):
    active = "active"
    suspended = "suspended"


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid7,
    )

    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tenants.tenant_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    email: Mapped[str] = mapped_column(
        String,
        nullable=True,
    )

    status: Mapped[UserStatus] = mapped_column(
        SQLEnum(UserStatus, name="user_status_enum"),
        nullable=False,
        default=UserStatus.active,
    )

    sso_subject: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    tenant: Mapped["Tenant"] = relationship(
        "Tenant",
        back_populates="users",
    )

    controls: Mapped[list["Control"]] = relationship(
        "Control",
        back_populates="owner_user",
        foreign_keys="[Control.owner]",
    )


class ControlStatus(str, Enum):
    passing = "Passing"
    failing = "Failing"
    stale = "Stale"
    not_assessed = "Not Assessed"
    in_remediation = "In Remediation"


# Framework table
class Framework(Base):
    __tablename__ = "frameworks"

    framework_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid7,
    )
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
    )
    version: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )


# Control table
class Control(Base):
    __tablename__ = "controls"

    control_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid7,
    )
    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tenants.tenant_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    framework_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("frameworks.framework_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    status: Mapped[ControlStatus] = mapped_column(
        SQLEnum(ControlStatus, name="control_status_enum"),
        nullable=False,
        default=ControlStatus.not_assessed,
    )
    owner: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    owner_user: Mapped["User"] = relationship(
        "User",
        back_populates="controls",
        foreign_keys=[owner],
    )

    evidence_requirements: Mapped[list["EvidenceRequirement"]] = relationship(
        "EvidenceRequirement",
        back_populates="control",
        cascade="all, delete-orphan",
    )

    evidence_items: Mapped[list["Evidence"]] = relationship(
        "Evidence",
        back_populates="control",
        cascade="all, delete-orphan",
    )


# ENUM — Review Status
class ReviewStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


# TABLE 1: evidence_requirements
class EvidenceRequirement(Base):
    """
    Defines the type and refresh cadence of evidence required
    for a particular compliance control.
    """

    __tablename__ = "evidence_requirements"

    requirement_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid7,
        nullable=False,
    )

    control_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "controls.control_id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

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

    # Many EvidenceRequirement → One Control
    control: Mapped[Control] = relationship(
        "Control",
        back_populates="evidence_requirements",
    )

    # One EvidenceRequirement → Many Evidence
    evidence_items: Mapped[list["Evidence"]] = relationship(
        "Evidence",
        back_populates="requirement",
        cascade="all, delete-orphan",
    )


# TABLE 2: evidence
class Evidence(Base):
    """
    Stores metadata and storage pointers for collected evidence.

    Evidence is tenant-scoped through tenant_id and is protected
    by PostgreSQL Row-Level Security.
    """

    __tablename__ = "evidence"

    evidence_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid7,
        nullable=False,
    )

    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "tenants.tenant_id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    control_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "controls.control_id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    requirement_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "evidence_requirements.requirement_id",
            ondelete="SET NULL",
        ),
        nullable=False,
        index=True,
    )

    sha256: Mapped[str | None] = mapped_column(
        String(64),
        nullable=False,
    )

    blob_s3_key: Mapped[str | None] = mapped_column(
        String(512),
        nullable=False,
    )

    collected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    connector: Mapped[str | None] = mapped_column(
        Text,
        nullable=False,
    )

    source_ref: Mapped[str | None] = mapped_column(
        Text,
        nullable=False,
    )

    artefact_type: Mapped[str | None] = mapped_column(
        Text,
        nullable=False,
    )

    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

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
