import logging
import re
import uuid
from collections.abc import Callable

from app.db.audit_models import AuditLog
from app.db.session import AsyncSessionLocal
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

# Track only state-mutating HTTP methods
MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Matches pattern: /v1/<resource>/<uuid> or /v1/<resource>
RESOURCE_PATTERN = re.compile(r"^/v[0-9]+/([a-zA-Z0-9_\-]+)(?:/([0-9a-fA-F\-]{36}))?")


class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # 1. Skip non-mutating verbs (GET, HEAD, OPTIONS, etc.)
        if request.method not in MUTATING_METHODS:
            return await call_next(request)

        # 2. Allow upstream auth/route processing to complete
        response = await call_next(request)

        # 3. Only audit successful state mutations (2xx)
        if not (200 <= response.status_code < 300):
            return response

        # 4. Safe context parsing via getattr to avoid crashes on unauthenticated routes
        tenant_id = getattr(request.state, "tenant_id", None)
        actor_id = getattr(request.state, "user_id", None)

        if not tenant_id:
            return response

        # 5. Extract target formatted as <resource>::<uuid>
        match = RESOURCE_PATTERN.search(request.url.path)
        if match:
            resource = match.group(1)
            target_id = match.group(2) or str(uuid.uuid4())
            target = f"{resource}::{target_id}"
        else:
            target = f"path::{request.url.path}"

        # 6. Extract trace and client metadata
        raw_request_id = getattr(request.state, "request_id", None)
        if raw_request_id:
            try:
                request_id = (
                    raw_request_id
                    if isinstance(raw_request_id, uuid.UUID)
                    else uuid.UUID(str(raw_request_id))
                )
            except ValueError:
                request_id = uuid.uuid4()
        else:
            request_id = uuid.uuid4()

        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

        # 7. Independent DB session decoupled from route transaction lifecycle
        async with AsyncSessionLocal() as session:
            try:
                # Apply tenant context for Row-Level Security (RLS)
                await session.execute(
                    text("SET LOCAL app.tenant_id = :tenant_id"),
                    {"tenant_id": str(tenant_id)},
                )

                log_entry = AuditLog(
                    tenant_id=tenant_id,
                    actor_id=actor_id,
                    action=request.method,
                    target=target,
                    request_id=request_id,
                    ip_address=client_ip,
                    user_agent=user_agent,
                )
                session.add(log_entry)
                await session.commit()
            except SQLAlchemyError as exc:
                await session.rollback()
                logger.error("Failed to commit audit log record: %s", exc)

        return response
