import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
import jwt
import redis.asyncio as redis
from app.core.config import settings
from app.db.models import BreakGlassSession, BreakGlassStatus
from app.db.session import AsyncSessionLocal, tenant_id_context
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from starlette.middleware.base import BaseHTTPMiddleware

pool = redis.ConnectionPool.from_url(
    settings.VALKEY_URL, decode_responses=True, max_connections=20
)
valkey = redis.Redis(connection_pool=pool)

# Set up logging for developers
logger = logging.getLogger("cygrc.auth")

JWKS_CACHE_TTL = 300  # seconds, matches the old in-memory TTL
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX_REQUESTS = 120  # per tenant, per window — tune later

BREAK_GLASS_SCOPES = [
    "controls:read",
    "evidence:read",
    "risks:read",
    "audits:read",
    "auditlog:read",
]

ROLE_SCOPES: dict[str, list[str]] = {
    "PLATFORM_OPERATOR": [
        "operator:admin",
        "operator:break-glass",
        "frameworks:read",
        "frameworks:write",
    ],
    "TENANT_ADMIN": [
        "controls:read",
        "controls:write",
        "evidence:read",
        "evidence:write",
        "evidence:review",
        "frameworks:read",
        "auditlog:read",
        "audits:read",
        "audits:write",
        "audits:export",
        "risks:read",
        "risks:write",
        "risks:close",
        "dpdp:read",
        "dpdp:write",
        "users:read",
        "users:write",
        "users:delete",
        "ai:draft",
        "ai:approve",
    ],
    "COMPLIANCE_MANAGER": [
        "controls:read",
        "controls:write",
        "evidence:read",
        "evidence:review",
        "frameworks:read",
        "risks:read",
        "risks:close",
        "ai:draft",
        "ai:approve",
    ],
    "INTERNAL_AUDITOR": [
        "controls:read",
        "evidence:read",
        "audits:read",
        "audits:write",
        "audits:export",
        "frameworks:read",
    ],
    "RISK_OWNER": [
        "controls:read",
        "risks:read",
        "risks:write",
        "evidence:read",
        "risks:close",
        "frameworks:read",
    ],
    "CISO": [
        "evidence:review",
        "evidence:read",
        "controls:read",
        "risks:read",
        "audits:read",
        "dpdp:read",
        "auditlog:read",
        "users:read",
        "frameworks:read",
        "risks:close",
    ],
    "DPO": ["dpdp:read", "dpdp:write", "controls:read", "ai:draft"],
    "ENGINEERING_LEAD": ["controls:read", "evidence:write"],
    "USER": ["controls:read", "evidence:write"],
}


class KeycloakAuthMiddleware(BaseHTTPMiddleware):
    """
    CyGRC Authentication & Tenant Isolation Middleware.

    This middleware intercepts every incoming HTTP request and performs security checks
    to resolve the active tenant_id and user_id.

    """

    def __init__(self, app, keycloak_jwks_url: str, app_env: str = "local"):
        super().__init__(app)
        self.jwks_url = keycloak_jwks_url
        self.app_env = app_env.strip().lower()

    async def get_public_key(self, kid: str) -> dict[str, Any] | None:
        """Valkey-backed replacement for the old in-memory dict."""
        cache_key = f"jwks:{kid}"
        cached = await valkey.get(cache_key)
        if cached:
            return json.loads(cached)
        try:
            logger.info(f"Fetching fresh JWKS keys from Keycloak: {self.jwks_url}")
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(self.jwks_url)
                if response.status_code != 200:
                    logger.error(
                        f"Failed to fetch JWKS keys. Status: {response.status_code}"
                    )
                    return None
                jwks = response.json()
                pipe = valkey.pipeline()
                for key in jwks.get("keys", []):
                    pipe.setex(f"jwks:{key['kid']}", JWKS_CACHE_TTL, json.dumps(key))
                await pipe.execute()
        except Exception:
            logger.exception("Network error contacting Keycloak JWKS")
            return None

        cached = await valkey.get(cache_key)
        return json.loads(cached) if cached else None

    async def check_rate_limit(self, identifier: str) -> bool:
        """Returns True if the request should proceed, False if rate-limited."""
        key = f"ratelimit:{identifier}"
        count = await valkey.incr(key)
        if count == 1:
            await valkey.expire(key, RATE_LIMIT_WINDOW)
        return count <= RATE_LIMIT_MAX_REQUESTS

    async def dispatch(self, request: Request, call_next) -> Response:
        client_ip = request.client.host if request.client else "unknown"
        if not await self.check_rate_limit(client_ip):
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Try again shortly."},
            )
        if request.url.path in [
            "/healthz",
            "/docs",
            "/openapi.json",
            "/redoc",
            "/v1/onboard",
            "/auth/callback",
        ]:
            return await call_next(request)

        tenant_id: uuid.UUID | None = None
        user_id: uuid.UUID | None = None
        roles: list[str] = []
        scopes: list[str] = []

        auth_header = request.headers.get("Authorization")

        # ── Priority 1: Decode and Validate Keycloak JWT ─────────────────────────
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                unverified_header = jwt.get_unverified_header(token)
                kid = unverified_header.get("kid")

                if not kid:
                    return JSONResponse(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        content={
                            "detail": "Malformed token header: 'kid' parameter is missing."
                        },
                    )

                jwk = await self.get_public_key(kid)

                if not jwk:
                    return JSONResponse(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        content={
                            "detail": "Invalid JWT Token. Verification key ID ('kid') not recognized."
                        },
                    )

                public_key = jwt.algorithms.RSAAlgorithm.from_jwk(jwk)

                payload = jwt.decode(
                    token,
                    public_key,
                    algorithms=["RS256"],
                    options={"verify_aud": False},
                )

                payload_tenant_id = payload.get("tenant_id")
                payload_user_id = payload.get("sub")
                payload_roles = payload.get("realm_access", {}).get("roles", [])

                if not payload_tenant_id:
                    return JSONResponse(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        content={
                            "detail": "Invalid JWT payload. Attribute 'tenant_id' is missing."
                        },
                    )

                tenant_id = uuid.UUID(payload_tenant_id)
                user_id = uuid.UUID(payload_user_id) if payload_user_id else None
                roles = payload_roles
                scopes = [s for r in roles for s in ROLE_SCOPES.get(str(r).upper(), [])]

            except jwt.ExpiredSignatureError:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={
                        "detail": "Authentication token has expired. Request a new login."
                    },
                )

            except jwt.InvalidTokenError as e:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={
                        "detail": f"Cryptographic token verification failed: {e!s}"
                    },
                )

            except (ValueError, TypeError):
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "Invalid authentication token."},
                )
        if not tenant_id or not user_id:
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid authorization context."},
            )

        if "PLATFORM_OPERATOR" in roles:
            bg_session_id_header = request.headers.get("X-Break-Glass-Session")
            if bg_session_id_header:
                try:
                    bg_session_uuid = uuid.UUID(bg_session_id_header)
                except ValueError:
                    return JSONResponse(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        content={
                            "detail": "X-Break-Glass-Session header is not a valid UUID."
                        },
                    )

                async with AsyncSessionLocal() as bg_db:
                    result = await bg_db.execute(
                        select(BreakGlassSession).where(
                            BreakGlassSession.session_id == bg_session_uuid
                        )
                    )
                    bg_session = result.scalar_one_or_none()

                now = datetime.now(timezone.utc)
                if (
                    bg_session is None
                    or bg_session.requested_by != user_id
                    or bg_session.status != BreakGlassStatus.ACTIVE
                    or bg_session.expires_at is None
                    or bg_session.expires_at < now
                ):
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content={
                            "detail": "Break-glass session is invalid, not yours, expired, or not active."
                        },
                    )

                # Everything below is the actual grant, only reached if the session
                # checked out completely.
                tenant_id = bg_session.target_tenant_id
                scopes = BREAK_GLASS_SCOPES
                request.state.break_glass_session_id = bg_session.session_id
                request.state.break_glass_ticket = bg_session.ticket_ref

                logger.warning(
                    f"BREAK-GLASS REQUEST: operator={user_id} tenant={tenant_id} "
                    f"ticket={bg_session.ticket_ref} path={request.url.path}"
                )

        request.state.tenant_id = tenant_id
        request.state.user_id = user_id
        request.state.roles = roles
        request.state.scopes = scopes

        token_context = tenant_id_context.set(tenant_id)
        try:
            response = await call_next(request)
            return response
        finally:
            tenant_id_context.reset(token_context)
