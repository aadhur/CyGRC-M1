from app.db.audit_models import AuditLog
from app.db.session import AsyncSessionLocal
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from uuid6 import uuid7


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

        # Extract resource and UUID from path for target pattern
        # Format: <resource>::<uuid> e.g. controls::0191a38a-xxxx
        path_parts = request.url.path.strip("/").split("/")
        resource = path_parts[-2] if len(path_parts) >= 2 else path_parts[-1]
        uuid_part = path_parts[-1] if len(path_parts) >= 2 else "unknown"
        target = f"{resource}::{uuid_part}"

        # Use independent Session B — keeps audit commits separate from
        # route transaction rollback blocks
        async with AsyncSessionLocal() as session:
            try:
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
            except Exception:  # noqa: BLE001
                await session.rollback()

        return response
