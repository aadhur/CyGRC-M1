from app.api.v1.audit_log import router as audit_router
from app.api.v1.controls import router as controls_router
from app.api.v1.evidence import router as evidence_router
from app.api.v1.frameworks import router as frameworks_router

# 2. Import Existing Router
from app.api.v1.onboard import router as onboard_router
from app.api.v1.users import router as user_router
from app.core.config import settings

# Audit Middleware intercepts state-changing HTTP requests (#B4.2)
from app.middleware.audit import AuditLogMiddleware

# 1. Import Middlewares
# Auth Middleware sets request.state.tenant_id and user_id
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
# Middlewares (Order LIFO: Cors -> Audit -> Auth)
# ------------------------------------------------------------------------------

# Layer 1: CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Layer 2: Audit Logging Middleware (#B4.2)
app.add_middleware(AuditLogMiddleware)

# Layer 3: Keycloak Auth Middleware
app.add_middleware(
    KeycloakAuthMiddleware,
    keycloak_jwks_url=settings.KEYCLOAK_JWKS_URL,
    app_env=settings.APP_ENV,
)

# ------------------------------------------------------------------------------
# API Routers
# ------------------------------------------------------------------------------

# System & Onboarding
app.include_router(onboard_router)
app.include_router(user_router, prefix="/v1/users", tags=["Users"])


# Issue #B4.1: Controls & Frameworks (Squad S1)
app.include_router(controls_router, prefix="/v1/controls", tags=["Controls"])
app.include_router(frameworks_router, prefix="/v1/frameworks", tags=["Frameworks"])

# Issue #B5: Evidence Upload & Review (Squad S2)
app.include_router(evidence_router, prefix="/v1/evidence", tags=["Evidence"])

# Issue #B4.2: Immutable Audit Log (Squad S3)
app.include_router(audit_router, prefix="/v1/audit-log", tags=["Audit Log"])


@app.get("/healthz", tags=["Health"])
def health_check():
    return {"status": "healthy"}
