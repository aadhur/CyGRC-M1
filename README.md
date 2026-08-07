# CyGRC-M1 DOCUMENTATION

## REPO LAYOUT

```text
cygrc-platform/
├── .github/
│   └── workflows/
│       └── ci.yml             # CI Pipeline (Lints, Secrets, & CVE Scans)
├── .gitignore                 
├── .pre-commit-config.yaml    # Pre-commit formatting & security checks (Ruff & Gitleaks)
├── docker-compose.yml         # Shared local service stack (PostgreSQL, Valkey, Keycloak, MinIO) (Check below for credentials)
├── README.md                  
├── frontend/                       
│   └── src/
├── backend/                   
│   ├── core/                  
│   │   ├── app/
│   └── notification/          # webhooks
└── scripts/
    └── seed_dev_db.py         # checks for postgresSQL connection for now
```

## SETUP INSTRUCTIONS


### Step 1: Pre-requisites & OS Environment
Download and install these **5 tools**:
* **Docker Desktop (v27.x)**
* **Node.js (v20 LTS)**
* **Python (v3.12.x)**
* **Git**
* **VS Code**

#### Windows Users Only (WSL 2 Setup)
Since our databases run inside Linux container images, Windows users must configure **WSL 2 (Windows Subsystem for Linux)**:
1. Open PowerShell as Administrator and run:
   ```powershell
   wsl --install
   ```
2. Reboot your laptop.
3. Open **Docker Desktop**, go to **Settings > General**, and verify **"Use the WSL 2 based engine"** is checked.

*(Mac users can skip the WSL step entirely)*

### Step 2: Clone and Start Databases
Keep Docker Desktop running in the background (the bottom-left corner should show `Engine running`)
Open your terminal and run:
```bash
git clone https://github.com/aadhur/CyGRC-M1.git
cd CyGRC-M1
docker-compose up -d
```
You can verify the services are active by visiting:
* **Keycloak Portal:** [http://localhost:8080](http://localhost:8080) *(Credentials: admin/admin_password_123)*
* **MinIO Console:** [http://localhost:9001](http://localhost:9001) *(Credentials: minio_local_admin/minio_local_password_123)*

### Step 3: Setup Virtual Environment & Run Diagnostics
Navigate to the FastAPI folder, initialize your environment, and test database connectivity:
```bash
# Move into backend core
cd backend/core

# Create Python virtual environment
python -m venv venv

# Activate venv (Mac/Linux)
source venv/bin/activate
# Activate venv (Windows Command Prompt)
venv\Scripts\activate
# Activate venv (Windows PowerShell)
venv\Scripts\Activate.ps1

# Install core packages and run diagnostics
pip install -r requirements.txt #for the seeder script
python ../../scripts/seed_dev_db.py
```
If you see **`PostgreSQL Connection: OK`**, then the seeder works. 

## Additional Information
- Documentation in Code: You can learn about the exact function and execution behavior of each script by reading the opening comments inside the source files.
- Branch Protection Rules: The main branch has branch protection rules configured:
  - Require a Pull Request before merging (direct pushes to main are blocked).
  - Require status checks (code-quality and security-scan) to pass before merging.
  - Require approval before merging (set to 1 approval for now).

  