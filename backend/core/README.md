# CyGRC Backend — Local Setup

## Step 1. Activate the virtual environment

```powershell
cd backend\core
```
For windows:
```
venv\Scripts\Activate.ps1
```
For Linux/Mac OS:
```
source venv/bin/activate
```

## Step 2. Install dependencies

```powershell
pip install -r requirements.txt
```

## Step 3. Run the app with Uvicorn

```powershell
uvicorn app.main:app --reload --port 8000
```

## Step 4. Verify the health check

Open in a browser or run:

```powershell
curl http://localhost:8000/healthz
```

Expected response:

```json
{"status": "healthy"}
```