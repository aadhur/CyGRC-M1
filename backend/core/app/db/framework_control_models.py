from enum import Enum
from uuid import UUID

from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from uuid6 import uuid7


class Base(DeclarativeBase):
    pass


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
        String,
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


# TODO: Add User relationship when User model is integrated
#     # Relations (User -> Control and Evidence -> Control)
#     owner_user: Mapped["User"] = relationship(
#         "User",
#         back_populates="controls",
#     )
# TODO: Add Evidence relationship when Evidence model is integrated
#     evidence_items: Mapped[list["Evidence"]] = relationship(
#         "Evidence",
#         back_populates="control",
#         cascade="all, delete-orphan",
#     )
