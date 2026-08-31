from datetime import datetime, timezone
from enum import Enum
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from uuid6 import uuid7


class Base(DeclarativeBase):
    pass


class TenantStatus(str, Enum):
    PROVISIONING = "provisioning"
    ACTIVE = "active"
    DELETING = "deleting"


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


class UserStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"


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
        default=UserStatus.ACTIVE,
    )

    sso_subject: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    tenant: Mapped["Tenant"] = relationship(
        "Tenant",
        back_populates="users",
    )
