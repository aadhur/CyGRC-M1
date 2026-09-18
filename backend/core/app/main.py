from app.api.v1.ai import router as ai_router
from app.api.v1.audit_log import router as log_audit_router
from app.api.v1.audits import router as audit_router
from app.api.v1.controls import router as controls_router
from app.api.v1.dpdp import router as dpdp_router
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

# Layer 1: CORS (Outermost - attaches headers even on errors)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,  # e.g. ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Layer 2: Audit Logging Middleware
app.add_middleware(AuditLogMiddleware)

# Layer 3: Keycloak Auth Middleware (Ensure in-memory JWKS caching is enabled inside)
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
app.include_router(log_audit_router, prefix="/v1/audit-log", tags=["Audit Log"])
app.include_router(risk_router, prefix="/v1/risks", tags=["Risks"])
app.include_router(audit_router, prefix="/v1/audits", tags=["Audits"])
app.include_router(dpdp_router, prefix="/dpdp/breach-clock", tags=["DPDP Breach Clock"])
app.include_router(ai_router, prefix="/v1/ai", tags=["AI"])


@app.get("/healthz", tags=["Health"])
def health_check():
    return {"status": "healthy"}
