-- init-db.sql

-- 1. Create non-superuser app role with strict RLS enforcement
CREATE ROLE grc_app_test WITH LOGIN PASSWORD 'test_password_123' NOSUPERUSER NOBYPASSRLS;

-- 2. Schema and DB connection permissions
GRANT CONNECT ON DATABASE grc_platform TO grc_app_test;
GRANT USAGE ON SCHEMA public TO grc_app_test;

-- 3. Set DEFAULT privileges (Applies automatically when Alembic creates tables/sequences)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO grc_app_test;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO grc_app_test;