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

## 2. Tenant Onboarding & Identity Provisioning

**Endpoint:** `POST /v1/onboard`

Executes the onboarding flow: provisions the tenant, registers the user/admin in Keycloak, issues an access token, and dynamically seeds the 93 ISO 27001 compliance controls.

### Using cURL

```bash
curl -X POST \
  'http://127.0.0.1:8000/v1/onboard' \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "CORP",
    "plan": "Enterprise",
    "email": "compliance_admin@acme.com",
    "password": "SecurePassword123!",
    "role": "user" 
  }'
```

### Using Swagger UI

The API can also be tested through FastAPI's Swagger UI:

Navigate to `http://localhost:8000/docs`, select **POST /v1/onboard**, click **Try it out**, fill in the request body, and click **Execute**.

### Successful Response

**Status:** `201 Created`

```json
{
  "tenant_id": "01a06817-3432-7468-913d-230901014956",
  "user_id": "01a06817-3433-762e-bcc7-47dd21e35dd9",
  "status": "active",
  "message": "Tenant 'CORP' created and dynamically seeded with active frameworks.",
  "access_token": "eyJhb..."
}
```

### Direct Database Verification (PostgreSQL & RLS)

To verify tenant creation, user creation, and the 93 seeded ISO 27001 controls inside PostgreSQL:

1. **Connect to the PostgreSQL container:**

   ```bash
   docker exec -it cygrc-postgres psql -U grc_user -d grc_platform
   ```

2. **Verify public tables (Tenants & Users):**

   ```sql
   SELECT tenant_id, name, status, plan FROM tenants;
   SELECT user_id, tenant_id, email, role FROM users;
   ```

3. **Verify Row-Level Security (RLS) isolated controls:**
   
   To verify RLS, you should work as a test user:

   ```sql
    -- 1. Create a clean, non-superuser role
    CREATE ROLE grc_app_test WITH LOGIN PASSWORD 'test_password_123';

    -- 2. Grant usage on the public schema boundary
    GRANT USAGE ON SCHEMA public TO grc_app_test;

    -- 3. Explicitly grant transactional privileges to GRC compliance tables
    GRANT SELECT, INSERT, UPDATE, DELETE ON tenants, users, controls, frameworks, evidence, evidence_requirements TO grc_app_test;

    -- 4. Grant primary key sequence permissions
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO grc_app_test;

    -- 5. Switch to the test user 
    \c grc_platform grc_app_test
    (Enter 'test_password_123' if prompted)

   ```

   Because RLS is enforced on `controls`, you must set `app.tenant_id` to match your tenant's ID before querying, and reset it afterward:

   ```sql
   -- Set tenant context for the session (replace UUID with your actual tenant_id)
   SET app.tenant_id = '{tenant_id}';

   -- Verify seeded ISO 27001 controls count (should return 93)
   SELECT count(*) FROM controls;

   -- View sample seeded controls
   SELECT code, title, status FROM controls LIMIT 5;

   -- Clear tenant context session variable
   RESET app.tenant_id;
  
   -- Checkc controls count again (should return 0 rows)
   SELECT COUNT(*) FROM controls; 
   ```


4. **Exit the PostgreSQL terminal:**

   ```sql
   \q
   ```

### Keycloak Identity Verification

To verify that the administrator user was provisioned inside Keycloak:

1. Access the Keycloak Admin Console at `http://localhost:8080`.
2. Log in with admin credentials.
3. Select the `grc-platform` realm from the top-left dropdown.
4. Navigate to **Users** in the sidebar.
5. Verify that the user exists and contains the custom user attribute `tenant_id` matching your tenant's UUID.
