import logging
import time
import uuid
from typing import Any

import httpx
import jwt
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from ..db.session import tenant_id_context

# Set up logging for developers
logger = logging.getLogger("cygrc.auth")

ROLE_SCOPES: dict[str, list[str]] = {
    "platform_operator": ["operator:admin", "operator:break-glass", "frameworks:read"],
    "tenant_admin": [
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
    "compliance_manager": [
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
    "internal_auditor": [
        "controls:read",
        "evidence:read",
        "audits:read",
        "audits:write",
        "audits:export",
        "frameworks:read",
    ],
    "risk_owner": [
        "controls:read",
        "risks:read",
        "risks:write",
        "evidence:read",
        "risks:close",
        "frameworks:read",
    ],
    "ciso": [
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
        "risks:read",
    ],
    "dpo": ["dpdp:read", "dpdp:write", "controls:read", "ai:draft"],
    "engineering_lead": ["controls:read", "evidence:write"],
    "user": ["controls:read", "evidence:write"],
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
        self.cached_keys: dict[str, Any] = {}
        self.keys_last_fetched: float = 0
        self.cache_ttl = 300

    async def get_public_key(self, kid: str) -> dict[str, Any] | None:
        """Fetch and cache public keys (JWKS) from the Keycloak server dynamically."""
        current_time = time.time()
        if not self.cached_keys or (
            current_time - self.keys_last_fetched > self.cache_ttl
        ):
            try:
                logger.info(f"Fetching fresh JWKS keys from Keycloak: {self.jwks_url}")
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(self.jwks_url)
                    if response.status_code == 200:
                        jwks = response.json()
                        self.cached_keys = {
                            key["kid"]: key for key in jwks.get("keys", [])
                        }
                        self.keys_last_fetched = current_time
                    else:
                        logger.error(
                            f"Failed to fetch JWKS keys. Status: {response.status_code}"
                        )
            except Exception:
                logger.exception("Network error contacting Keycloak JWKS")

        return self.cached_keys.get(kid)

    async def dispatch(self, request: Request, call_next) -> Response:
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
                scopes = [s for r in roles for s in ROLE_SCOPES.get(r, [])]

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

        # ── Priority 2: Developer Header Fallback (Local Dev Only) ───────────────
        elif self.app_env == "local":
            test_tenant_header = request.headers.get("X-Test-Tenant-ID")
            test_user_header = request.headers.get("X-Test-User-ID")
            if not test_tenant_header or not test_user_header:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "Missing test tenant/user headers."},
                )
            tenant_id = uuid.UUID(test_tenant_header)
            user_id = uuid.UUID(test_user_header)
            roles = ["tenant_admin"]
            scopes = ROLE_SCOPES["tenant_admin"]

        # ── If Both Pri 1 and Pri 2 Fail, Reject Request Immediately ──────────────
        if not tenant_id or not user_id:
            # If in local mode, specify what headers dev can provide
            if self.app_env == "local":
                detail_msg = (
                    "Missing active tenant context. Provide a valid Bearer JWT "
                    "or include local testing headers: 'X-Test-Tenant-ID' and 'X-Test-User-ID'."
                )
            else:
                detail_msg = "Missing or invalid authorization context. Provide a verified Bearer JWT."

            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": detail_msg}
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
