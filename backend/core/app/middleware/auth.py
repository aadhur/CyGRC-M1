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
    "PLATFORM_OPERATOR": ["operator:admin", "operator:break-glass", "frameworks:write"],
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
        self.cached_keys: dict[str, Any] = {}
        self.keys_last_fetched: float = 0
        self.cache_ttl = 300

    async def get_public_key(self, kid: str) -> dict[str, Any] | None:
        """Fetch and cache public keys (JWKS) from Keycloak dynamically."""
        current_time = time.time()
        cache_expired = (current_time - self.keys_last_fetched) > self.cache_ttl
        key_missing = kid not in self.cached_keys

        # Refetch if cache expired OR if a new 'kid' is received
        if not self.cached_keys or cache_expired or key_missing:
            try:
                logger.info(
                    f"Fetching JWKS keys from Keycloak (Reason: expired={cache_expired}, missing_key={key_missing})"
                )
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
