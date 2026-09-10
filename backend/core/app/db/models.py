import enum
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from uuid6 import uuid7


class Base(DeclarativeBase):
    pass


# =============================================================================
#                              TENANTS TABLE
# =============================================================================


class TenantStatus(str, enum.Enum):
    PROVISIONING = "PROVISIONING"
    ACTIVE = "ACTIVE"
    DELETING = "DELETING"


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
        SQLEnum(
            TenantStatus,
            name="tenant_status_enum",
            values_callable=lambda x: [e.value for e in x],
            validate_strings=True,
        ),
        nullable=False,
        default=TenantStatus.PROVISIONING,
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


# =============================================================================
#                              USERS TABLE
# =============================================================================


class UserRole(str, enum.Enum):
    TENANT_ADMIN = "TENANT_ADMIN"
    PLATFORM_OPERATOR = "PLATFORM_OPERATOR"
    COMPLIANCE_MANAGER = "COMPLIANCE_MANAGER"
    INTERNAL_AUDITOR = "INTERNAL_AUDITOR"
    RISK_OWNER = "RISK_OWNER"
    CISO = "CISO"
    DPO = "DPO"
    ENGINEERING_LEAD = "ENGINEERING_LEAD"
    USER = "USER"


class UserStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"


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
        SQLEnum(
            UserStatus,
            name="user_status_enum",
            values_callable=lambda x: [e.value for e in x],
            validate_strings=True,
        ),
        nullable=False,
        default=UserStatus.ACTIVE,
    )

    role: Mapped[UserRole] = mapped_column(
        SQLEnum(
            UserRole,
            name="user_role_enum",
            values_callable=lambda x: [e.value for e in x],
            validate_strings=True,
            create_type=False,
        ),
        nullable=False,
        default=UserRole.USER,
    )

    sso_subject: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    kc_user_id: Mapped[str] = mapped_column(
        String,
        unique=True,
        nullable=False,
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


# =============================================================================
#                            FRAMEWORKS TABLE
# =============================================================================


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


# =============================================================================
#                             CONTROLS TABLE
# =============================================================================


class ControlStatus(str, enum.Enum):
    PASSING = "PASSING"
    FAILING = "FAILING"
    STALE = "STALE"
    NOT_ASSESSED = "NOT_ASSESSED"
    IN_REMEDIATION = "IN_REMEDIATION"


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
        SQLEnum(
            ControlStatus,
            name="control_status_enum",
            values_callable=lambda x: [e.value for e in x],
            validate_strings=True,
        ),
        nullable=False,
        default=ControlStatus.NOT_ASSESSED,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

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


# =============================================================================
#                       EVIDENCE REQUIREMENTS TABLE
# =============================================================================


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

    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tenants.tenant_id", ondelete="CASCADE"),
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


# =============================================================================
#                              EVIDENCE TABLE
# =============================================================================


class ReviewStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


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
        nullable=True,
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
        default=ReviewStatus.PENDING.value,
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


# =============================================================================
#                               AUDITS TABLE
# =============================================================================


class AuditStatusEnum(str, enum.Enum):
    PLANNING = "PLANNING"
    IN_PROGRESS = "IN_PROGRESS"
    REMEDIATION = "REMEDIATION"
    CLOSED = "CLOSED"


class Audit(Base):
    __tablename__ = "audits"

    audit_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        nullable=False,
    )
    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tenants.tenant_id", ondelete="CASCADE"),
        nullable=False,
    )
    framework_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("frameworks.framework_id", ondelete="RESTRICT"),
        nullable=False,
    )
    period_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    period_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    status: Mapped[AuditStatusEnum] = mapped_column(
        SQLEnum(
            AuditStatusEnum,
            name="audit_status_enum",
            values_callable=lambda x: [e.value for e in x],
            create_type=False,
        ),
        nullable=False,
        default=AuditStatusEnum.PLANNING,
    )
    signed_off_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="SET NULL"),
        nullable=True,
    )


# =============================================================================
#                         AUDIT SCOPE CONTROLS TABLE
# =============================================================================


class AuditScopeControl(Base):
    __tablename__ = "audit_scope_controls"

    audit_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("audits.audit_id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    control_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("controls.control_id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tenants.tenant_id", ondelete="CASCADE"),
        nullable=False,
    )


# =============================================================================
#                         AUDIT CONTROL REVIEWS TABLE
# =============================================================================


class AuditVerdictEnum(str, enum.Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    EXCEPTION = "EXCEPTION"


class AuditControlReview(Base):
    __tablename__ = "audit_control_reviews"

    audit_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("audits.audit_id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    control_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("controls.control_id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tenants.tenant_id", ondelete="CASCADE"),
        nullable=False,
    )
    verdict: Mapped[AuditVerdictEnum] = mapped_column(
        SQLEnum(
            AuditVerdictEnum,
            name="audit_verdict_enum",
            values_callable=lambda x: [e.value for e in x],
            create_type=False,
        ),
        nullable=False,
    )
    reviewed_by: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="RESTRICT"),
        nullable=False,
    )
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


# =============================================================================
#                             FINDINGS TABLE
# =============================================================================


class FindingStatusEnum(str, enum.Enum):
    OPEN = "OPEN"
    IN_REMEDIATION = "IN_REMEDIATION"
    CLOSED = "CLOSED"


class FindingSeverityEnum(str, enum.Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class Finding(Base):
    __tablename__ = "findings"

    finding_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        nullable=False,
    )
    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tenants.tenant_id", ondelete="CASCADE"),
        nullable=False,
    )
    audit_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("audits.audit_id", ondelete="CASCADE"),
        nullable=False,
    )
    control_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("controls.control_id", ondelete="CASCADE"),
        nullable=False,
    )
    severity: Mapped[FindingSeverityEnum] = mapped_column(
        SQLEnum(
            FindingSeverityEnum,
            name="finding_severity_enum",
            values_callable=lambda x: [e.value for e in x],
            create_type=False,
        ),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="SET NULL"),
        nullable=True,
    )
    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[FindingStatusEnum] = mapped_column(
        SQLEnum(
            FindingStatusEnum,
            name="finding_status_enum",
            values_callable=lambda x: [e.value for e in x],
            create_type=False,
        ),
        nullable=False,
        default=FindingStatusEnum.OPEN,
    )


# =============================================================================
#                               RISKS TABLE
# =============================================================================


class RiskStatusEnum(str, enum.Enum):
    OPEN = "OPEN"
    TREATING = "TREATING"
    CLOSED = "CLOSED"
    ACCEPTED = "ACCEPTED"


class RiskTreatmentEnum(str, enum.Enum):
    AVOID = "AVOID"
    MITIGATE = "MITIGATE"
    TRANSFER = "TRANSFER"
    ACCEPT = "ACCEPT"


class Risk(Base):
    __tablename__ = "risks"

    risk_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        nullable=False,
    )
    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tenants.tenant_id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    likelihood: Mapped[int] = mapped_column(Integer, nullable=False)
    impact: Mapped[int] = mapped_column(Integer, nullable=False)
    inherent_risk_score: Mapped[int] = mapped_column(Integer, nullable=False)
    residual_risk_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    treatment: Mapped[RiskTreatmentEnum] = mapped_column(
        SQLEnum(
            RiskTreatmentEnum,
            name="risk_treatment_enum",
            values_callable=lambda x: [e.value for e in x],
            validate_strings=True,
            create_type=False,
        ),
        nullable=False,
    )
    treatment_plan: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_close_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[RiskStatusEnum] = mapped_column(
        SQLEnum(
            RiskStatusEnum,
            name="risk_status_enum",
            values_callable=lambda x: [e.value for e in x],
            validate_strings=True,
            create_type=False,
        ),
        nullable=False,
        default=RiskStatusEnum.OPEN,
    )


# =============================================================================
#                           RISK CONTROLS TABLE
# =============================================================================


class RiskControl(Base):
    __tablename__ = "risk_controls"

    risk_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("risks.risk_id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    control_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("controls.control_id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    # NEW — same reasoning as the audit bridge tables above.
    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tenants.tenant_id", ondelete="CASCADE"),
        nullable=False,
    )


# =============================================================================
#                       CONTROL STATUS HISTORY TABLE
# =============================================================================


class ControlStatusHistory(Base):
    __tablename__ = "control_status_history"

    history_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        nullable=False,
    )
    control_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("controls.control_id", ondelete="CASCADE"),
        nullable=False,
    )
    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tenants.tenant_id", ondelete="CASCADE"),
        nullable=False,
    )
    old_status: Mapped[str | None] = mapped_column(
        SQLEnum(
            "Not Assessed",
            "Passing",
            "Failing",
            "Stale",
            "In Remediation",
            name="control_status_enum",
            create_type=False,
        ),
        nullable=True,
    )
    new_status: Mapped[str] = mapped_column(
        SQLEnum(
            "Not Assessed",
            "Passing",
            "Failing",
            "Stale",
            "In Remediation",
            name="control_status_enum",
            create_type=False,
        ),
        nullable=False,
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
