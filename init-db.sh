#!/bin/bash
set -e

# Uses $APP_DB_USER and $APP_DB_PASSWORD if set, otherwise defaults to local dev credentials
APP_USER="${APP_DB_USER:-grc_app_test}"
APP_PASS="${APP_DB_PASSWORD:-test_password_123}"
DB_NAME="${POSTGRES_DB:-grc_platform}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB_NAME" <<-EOSQL
    -- 1. Create non-superuser app role with strict RLS enforcement
    CREATE ROLE $APP_USER WITH LOGIN PASSWORD '$APP_PASS' NOSUPERUSER NOBYPASSRLS;

    -- 2. Schema and DB connection permissions
    GRANT CONNECT ON DATABASE $DB_NAME TO $APP_USER;
    GRANT USAGE ON SCHEMA public TO $APP_USER;

    -- 3. Set DEFAULT privileges for Alembic migrations
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $APP_USER;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO $APP_USER;
EOSQL