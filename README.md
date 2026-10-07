# CyGRC Platform — Module 1

An enterprise Governance, Risk, and Compliance (GRC) platform automating continuous control monitoring, cryptographic evidence collection, 72-hour DPDP breach tracking, and human-in-the-loop AI drafting.

## Architecture & Service Map

The local environment is orchestrated as a multi-container Docker Compose mesh:

| Service | Port | Description | Credentials / Default Access |
| :--- | :--- | :--- | :--- |
| **Frontend** | `3000` | Next.js 15 (App Router), React 19, Tailwind CSS | Web UI |
| **Backend Core** | `8000` | FastAPI (Async), Uvicorn, SQLAlchemy, Alembic | OpenAPI Docs at `/docs` |
| **Keycloak IAM** | `8080` | OIDC / OAuth2 Identity Provider (Pre-seeded Realm) | `admin` / `admin_password_123` |
| **PostgreSQL 16** | `5432` | Primary Database with forced Row-Level Security (RLS) | `grc_user` / `grc_local_password_123` |
| **MinIO S3** | `9000` / `9001` | S3-Compatible Evidence Object Storage & Console | `minio_local_admin` / `minio_local_password_123` |
| **Valkey 8** | `6379` | In-memory cache for JWKS keys and IP rate limiting | Internal Redis protocol |
| **External SLM** | Colab Tunnel | Qwen2.5-7B (4-bit NF4 quantized on Tesla T4 GPU) | Injected via `SLM_ENDPOINT_URL` |

---

## Repository Layout

```text
CyGRC-M1/
├── docker-compose.yml              # Local multi-service mesh 
├── init-db.sh / realm-export.json  # DB bootstrap (non-superuser role) & Keycloak realm export
├── ai/slm_server.ipynb             # Qwen2.5-7B 4-bit SLM inference tunnel (Tesla T4 GPU)
├── .github/workflows/ci.yml        # CI pipeline (Ruff linter, Gitleaks, Trivy vulnerability scan)
│
├── backend/core/                   # FastAPI Backend (Python 3.11 / Async)
│   ├── alembic/versions/           # Migrations 0001–0010 
│   ├── app/
│   │   ├── main.py                 # Core API gateway mounting 11 domain routers
│   │   ├── api/v1/                 # 11 Scoped REST routers (controls, evidence, risks, audits, dpdp, ai, etc.)
│   │   ├── middleware/             # KeycloakAuthMiddleware and AuditLogMiddleware 
│   │   ├── services/               # Integrations: S3 MinIO, Keycloak IAM, Compliance Engine, SLM Client
│   │   ├── schemas/ & db/          # Pydantic v2 validation contracts & SQLAlchemy RLS models
│   │   ├── seeds/                  # Master framework data (only ISO 27001 controls & requirements)
│   │   └── utils/crypto.py         # Streaming SHA-256 evidence hasher
│   └── tests/                      # Automated Pytest suite 
│
├── frontend/                       # Client Application (Next.js 15 App Router / React 19)
│   ├── app/
│   │   ├── (app)/                  # Authenticated views (dashboard, controls, frameworks, risks, audits, dpdp, etc...)
│   │   ├── api/auth/refresh/       # Next.js backchannel token rotation endpoint
│   │   └── auth/, login/, onboard/ # OIDC authentication and workspace registration flows
│   ├── components/                 # UI widgets (AppSidebar, AppTopBar, BreakGlassBanner, StatusBadge etc...)
│   └── lib/                        # Client infrastructure: Token interceptor, RBAC (can/canAny), design tokens
│
└── docs/                           # Documentation: Final Report v1.0, PRD v3.0, and Sprint Issues 
```

## Quickstart & Setup

### Prerequisites
* **Docker Desktop** (v27+ recommended, with WSL 2 enabled on Windows)
* **Git**

### Step 1: Clone Repository
```bash
git clone https://github.com/aadhur/CyGRC-M1.git
cd CyGRC-M1
```

### Step 2: Configure Environment (Optional SLM)
If utilizing the local AI drafting assistant:
1. Open and run `ai/slm_server.ipynb` on a Google Colab T4 GPU runtime.
2. Copy the resulting public HTTPS ngrok tunnel URL.
3. Export the endpoint URL in your terminal:
   ```powershell
   # Windows PowerShell
   $env:SLM_ENDPOINT_URL="https://xxxxxxxx.ngrok-free.app"
   ```

### Step 3: Launch Full-Stack Mesh
```bash
docker compose up -d --build
```

Docker Compose will automatically:
1. Boot PostgreSQL and run `init-db.sh` to configure the non-superuser application role (`NOSUPERUSER NOBYPASSRLS`).
2. Initialize Valkey and Keycloak (importing the pre-configured `cyart-platform` realm).
3. Initialize MinIO and provision the `cygrc-evidence` storage bucket.
4. Run all Alembic database migrations (`alembic upgrade head`) and start FastAPI.
5. Compile and launch the Next.js frontend on `http://localhost:3000`.

---

## Accessing the Platform

* **Frontend Web App**: [http://localhost:3000](http://localhost:3000)
  * **To Register a New Workspace**: Navigate to `/onboard` and fill out your organization details.
  * **Pre-seeded Platform Operators**: These can be directly logged in without registration.
    * Operator 1: `operator1@cyart.com` / `OperatorSecurePassword2026!`
    * Operator 2: `operator2@cyart.com` / `OperatorSecurePassword2026!`
* **FastAPI Interactive Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **Keycloak Admin Console**: [http://localhost:8080](http://localhost:8080) (`admin` / `admin_password_123`)
* **MinIO Storage Console**: [http://localhost:9001](http://localhost:9001) (`minio_local_admin` / `minio_local_password_123`)

---

## Verification & Automated Test Suite

To execute the backend verification test harness (including PostgreSQL RLS bypass checks, 35-endpoint RBAC scope matrix, and audit log immutability tests):

```bash
docker compose exec backend pytest
```

## Documentation

Full architectural specifications, database models, and sprint tickets are archived under `docs/`:
* `docs/report/`: Main Engineering Implementation Report v1.0
* `docs/planning/`: Product Requirements Document (PRD v3.0) and Initial Proposal
* `docs/issues/`: Backend and Frontend issue specifications
