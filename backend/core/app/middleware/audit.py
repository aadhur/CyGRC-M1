import logging

from app.db.audit_models import AuditLog
from app.db.session import AsyncSessionLocal
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from uuid6 import uuid7

logger = logging.getLogger(__name__)


class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):

        # Execute request first — allows auth.py to run and inject
        # tenant_id and user_id into request.state before we read them
        response = await call_next(request)

        # Skip GET requests — read-only, no state change to log
        if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
            return response

        # Only log successful responses
        if not (200 <= response.status_code < 300):
            return response

        # Safely extract context — prevents AttributeError on public
        # endpoints like /docs or /v1/onboard where auth.py skips state
        tenant_id = getattr(request.state, "tenant_id", None)
        actor_id = getattr(request.state, "user_id", None)

        if not tenant_id or not actor_id:
            return response

        # Fix: strip version prefix and parse resource + uuid correctly
        # e.g. /v1/controls/0191a38a-xxxx -> controls::0191a38a-xxxx
        path_parts = [
            p
            for p in request.url.path.strip("/").split("/")
            if p and not p.startswith("v")  # strip version segments like v1, v2
        ]

        if len(path_parts) >= 2:
            resource = path_parts[-2]
            uuid_part = path_parts[-1]
        elif len(path_parts) == 1:
            resource = path_parts[0]
            uuid_part = "unknown"
        else:
            resource = "unknown"
            uuid_part = "unknown"

        target = f"{resource}::{uuid_part}"

        # Use independent Session B — keeps audit commits separate from
        # route transaction rollback blocks
        async with AsyncSessionLocal() as session:
            try:
                # Fix: set RLS tenant context so PostgreSQL knows which
                # tenant is executing this insert
                await session.execute(
                    text("SET LOCAL app.tenant_id = :tenant_id"),
                    {"tenant_id": str(tenant_id)},
                )

                log = AuditLog(
                    log_id=uuid7(),
                    tenant_id=tenant_id,
                    actor_id=actor_id,
                    action=request.method,
                    target=target,
                    request_id=uuid7(),
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                )
                session.add(log)
                await session.commit()

            except Exception as e:  # noqa: BLE001
                # Fix: log the error so pipeline debugging is possible
                logger.error("AuditLogMiddleware failed to write log entry: %s", str(e))
                await session.rollback()

        return response
