from app.db.base_class import Base
from sqlalchemy import Column, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import TIMESTAMPTZ, UUID
from sqlalchemy.sql import func

# Note: You may need to ensure the uuid6 package is in your requirements.txt
# if your team is using it for UUID v7 generation.
from uuid6 import uuid7


class AuditLog(Base):
    __tablename__ = "audit_log"

    log_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    tenant_id = Column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), index=True, nullable=False
    )
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action = Column(String, nullable=False)
    target = Column(String, nullable=False)
    request_id = Column(UUID(as_uuid=True), nullable=False)
    ip_address = Column(String, nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(TIMESTAMPTZ, server_default=func.now(), nullable=False)
