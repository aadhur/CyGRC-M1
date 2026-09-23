from app.api.v1.audit_log import router as log_audit_router
from app.api.v1.audits import router as audit_router
from app.api.v1.controls import router as controls_router
from app.api.v1.evidence import router as evidence_router
from app.api.v1.frameworks import router as frameworks_router
from app.api.v1.onboard import router as onboard_router
from app.api.v1.operators import router as operator_router
from app.api.v1.risks import router as risk_router
from app.api.v1.users import router as user_router
from app.core.config import settings
from app.middleware.audit import AuditLogMiddleware
from app.middleware.auth import KeycloakAuthMiddleware
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

app = FastAPI(
    title="CyGRC Core API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ------------------------------------------------------------------------------
# Middlewares
# ------------------------------------------------------------------------------
#
# Starlette's `app.add_middleware()` inserts each new middleware at the FRONT
# of the internal list, which means the middleware added LAST ends up as the
# OUTERMOST layer at runtime (i.e. it's the first to see an incoming request,
# and the last to touch an outgoing response). To get CORS to actually behave
# as the outermost layer, it must be the LAST call to add_middleware(), not
# the first. With the previous ordering, KeycloakAuthMiddleware was outermost
# and CORSMiddleware was innermost, so OPTIONS preflight requests (which carry
# no Authorization header) hit the auth middleware first, got rejected with a
# 401 that had no CORS headers attached, and the browser aborted the preflight
# before the real GET/POST ever reached the backend.
#
# Runtime order is therefore, outer -> inner:
#   CORSMiddleware -> AuditLogMiddleware -> KeycloakAuthMiddleware -> routes

# Layer 3: Keycloak Auth Middleware (added first -> ends up innermost)
app.add_middleware(
    KeycloakAuthMiddleware,
    keycloak_jwks_url=settings.KEYCLOAK_JWKS_URL,
    app_env=settings.APP_ENV,
)

# Layer 2: Audit Logging Middleware
app.add_middleware(AuditLogMiddleware)

# Layer 1: CORS (added last -> ends up outermost, so it can intercept
# preflight OPTIONS requests and attach CORS headers to every response,
# including errors raised by the middlewares/routes it wraps)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,  # e.g. ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------------------
# API Routers
# ------------------------------------------------------------------------------

app.include_router(
    operator_router, prefix="/v1/operators", tags=["Platform Operations"]
)
app.include_router(onboard_router, tags=["Tenant Onboarding"])
app.include_router(user_router, prefix="/v1/users", tags=["Users"])
app.include_router(controls_router, prefix="/v1/controls", tags=["Controls"])
app.include_router(frameworks_router, prefix="/v1/frameworks", tags=["Frameworks"])
app.include_router(evidence_router, prefix="/v1/evidence", tags=["Evidence"])
app.include_router(log_audit_router, prefix="/v1/audit-log", tags=["Audit Log"])
app.include_router(risk_router, prefix="/v1/risks", tags=["Risks"])
app.include_router(audit_router, prefix="/v1/audits", tags=["Audits"])


@app.get("/healthz", tags=["Health"])
def health_check():
    return {"status": "healthy"}
