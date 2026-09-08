from app.api.v1.audit_log import router as audit_router
from app.api.v1.controls import router as controls_router
from app.api.v1.evidence import router as evidence_router
from app.api.v1.frameworks import router as frameworks_router
from app.api.v1.onboard import router as onboard_router
from app.api.v1.operators import router as operator_router
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

# Layer 2: Audit Logging Middleware
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

app.include_router(
    operator_router, prefix="/v1/operators", tags=["Platform Operations"]
)

app.include_router(onboard_router, tags=["Tenant Onboarding"])

app.include_router(user_router, prefix="/v1/users", tags=["Users"])

app.include_router(controls_router, prefix="/v1/controls", tags=["Controls"])

app.include_router(frameworks_router, prefix="/v1/frameworks", tags=["Frameworks"])

app.include_router(evidence_router, prefix="/v1/evidence", tags=["Evidence"])

app.include_router(audit_router, prefix="/v1/audit-log", tags=["Audit Log"])


@app.get("/healthz", tags=["Health"])
def health_check():
    return {"status": "healthy"}
