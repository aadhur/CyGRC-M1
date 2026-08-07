# CyGRC-M1 DOCUMENTATION
Documentation for setting up, developing, and contributing to the CyGRC platform.

## REPO LAYOUT

```text
CyGRC-M1/
├── .github/
│   └── workflows/
│       └── ci.yml             # CI Pipeline (Lints, Secrets, & CVE Scans)
├── .gitignore                 
├── .pre-commit-config.yaml    # Pre-commit formatting & security checks (Ruff & Gitleaks)
├── docker-compose.yml         # Shared local service stack (PostgreSQL, Valkey, Keycloak, MinIO) (Check below for credentials)
├── README.md   
├── requirements.txt   
├── backend/                   
│   ├── core/                  
│   │   ├── app/
│   └── notification/          # webhooks           
├── frontend/                       
│   └── src/
└── scripts/
    └── seed_dev_db.py         # only checks PostgreSQL connectivity for now
```

## SETUP INSTRUCTIONS


### Step 1: Pre-requisites & OS Environment
Download and install these **5 tools**:

| Tool | Recommended Version | Download / Install Command |
| :--- | :--- | :--- |
| **Docker Desktop** | `v27.x` or later | [docker.com](https://www.docker.com/products/docker-desktop/) \| `winget install Docker.DockerDesktop` / `brew install --cask docker` |
| **Node.js** | `v20 LTS` | [nodejs.org](https://nodejs.org/) \| `nvm install 20` |
| **Python** | `v3.12.x` | [python.org](https://www.python.org/) \| `winget install Python.Python.3.12` / `brew install python@3.12` |
| **Git** | Latest | [git-scm.com](https://git-scm.com/) \| Included with Xcode Tools (macOS) / Git Bash (Windows) |
| **VS Code** | Latest | [code.visualstudio.com](https://code.visualstudio.com/) *(Recommended editor)* |

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
Keep Docker Desktop running in the background (the bottom-left corner should display `Engine running`)

Open your terminal and run:
```bash
git clone https://github.com/aadhur/CyGRC-M1.git

cd CyGRC-M1

docker-compose up -d
```


> ### *Note*
>
> If `docker compose up -d` takes a long time because Docker is downloading images, you can pull them manually first.
>
> Example:
>
> ```bash
> docker pull postgres:16-alpine
> ```
>
> Repeat for the remaining images defined in `docker-compose.yml`, then run:
>
> ```bash
> docker compose up -d
> ```

You can verify the services are active by visiting:
* **Keycloak Portal:** [http://localhost:8080](http://localhost:8080) *(Credentials: admin/admin_password_123)*
* **MinIO Console:** [http://localhost:9001](http://localhost:9001) *(Credentials: minio_local_admin/minio_local_password_123)*

### Step 3: Setup Virtual Environment & Run Diagnostics
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

# Install dependencies & Git pre-commit hooks
pip install -r ../../requirements.txt # for the seeder script
# These hooks will run automatically before every commit.
pip install pre-commit
pre-commit install

# Check DB connection 
python ../../scripts/seed_dev_db.py
```
If you see **`PostgreSQL Connection: OK`**, then the seeder works. 

## Additional Information
- Documentation in Code: Source files contain comments explaining module execution and architecture choices.
- Branch Protection Rules (Only on `main`)
  - Require a Pull Request before merging (direct pushes to main are blocked).
  - Require the `code-quality` and `security-scan` status checks to pass before merging. --> CI Pipeline runs
  - Require approval before merging (set to 1 approval for now).

## Contributing Guide

### 1. Create a Feature Branch

Never work directly on the `main` branch.

```bash
# For new features
git checkout -b feature/your-feature-name

# For bug fixes
git checkout -b fix/your-fix-name
```

Example:

```bash
git checkout -b feature/login-page
```

### 2. Make Your Changes

Edit the required files and save your changes.

### 3. Stage and Commit

```bash
git add .
git commit -m "Add login feature"
```

Note: Pre-commit hooks (Ruff & Gitleaks) run automatically on git commit. If hooks modify files (e.g., auto-formatting), re-stage and commit again.

### 4. Push Your Branch

```bash
git push -u origin feature/your-feature-name
```

### 5. Create a Pull Request

Open a Pull Request from your feature branch into the `main` branch.

The CI pipeline will automatically run the following checks:

- Code Quality (Ruff)
- Secret Scanning (Gitleaks)
- Container and Vulnerability Scanning (Trivy)

If any check fails, fix the reported issues and push your changes again. The Pull Request will automatically be updated and the CI pipeline will rerun.

Once:
- All CI checks pass.
- Required reviews are approved.
  
The Pull Request can then be merged into the `main` branch.

  