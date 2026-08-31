# Backend — Local Setup & Development Workflow

## Part 1: Setup


### Step 1: Start the Local Database Container

```bash
docker compose up -d 
```

### Step 2: Activate the Python Virtual Environment

Navigate to the core backend directory and activate your virtual environment:


### Step 3: Install Dependencies

Install the required Python modules in your local virtual environment:

```bash
pip install -r requirements.txt
```

### Step 4: Apply Initial Database Migrations (Alembic)

Apply the initial schema migrations to build the tables in your local PostgreSQL database:

```bash
alembic upgrade head
```

### Step 5: Run the Server with Uvicorn

Start your local FastAPI development server:

```bash
uvicorn app.main:app --reload --port 8000
```

## Part 2: API Verification

### 1. Health Check

**Endpoint:** `GET /healthz`

Checks whether the FastAPI application is running and responding successfully.

**Request:**

```bash
curl http://localhost:8000/healthz
```

**Expected Response:**

**Status:** `200 OK`

```json
{
  "status": "healthy"
}
```

---

### 2. Tenant Onboarding

**Endpoint:** `POST /v1/onboard`

Creates a new tenant and its associated user record in the local database.

#### Using cURL

```bash
curl -X POST \
  'http://127.0.0.1:8000/v1/onboard' \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Local Test",
    "plan": "Standard",
    "email": null
  }'
```

#### Using Swagger UI

The API can also be tested through FastAPI's Swagger UI:

`http://localhost:8000/docs`

Open the endpoint, select **Try it out**, provide the request body, and select **Execute**.

#### Successful Response

**Status:** `201 Created`

```json
{
  "tenant_id": "0191a38a-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "user_id": "0191a38a-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
}
```

A successful response confirms that the onboarding request was processed and that the corresponding tenant and user records were created.

> **Database Verification (Optional):**
> To verify the records directly in the local PostgreSQL database, connect to the database container:
>
> ```bash
> docker exec -it cygrc-postgres psql -U grc_user -d grc_platform
> ```
>
> Then query the created records:
>
> ```sql
> SELECT * FROM tenants;
> SELECT * FROM users;
> ```
>
> Type `\q` to exit the PostgreSQL terminal.
