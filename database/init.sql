-- =============================================================================
-- Kaka Malem Database Initialization Script
-- =============================================================================
-- Run this script as the postgres superuser:
-- sudo -u postgres psql -f init.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Create Database
-- -----------------------------------------------------------------------------
DROP DATABASE IF EXISTS kakamalem;
CREATE DATABASE kakamalem
    WITH
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TEMPLATE = template0
    CONNECTION LIMIT = -1;

-- Connect to the new database
\c kakamalem

-- -----------------------------------------------------------------------------
-- Enable Required Extensions
-- -----------------------------------------------------------------------------
-- UUID generation (for primary keys)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pgcrypto for password hashing and encryption
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- pg_stat_statements for query performance monitoring
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Full-text search (already built-in, but create config)
-- This is useful for product search
CREATE TEXT SEARCH CONFIGURATION IF NOT EXISTS afghan (COPY = english);

-- pg_trgm for fuzzy text search (typo-tolerant search)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- btree_gist for exclusion constraints (useful for scheduling)
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- -----------------------------------------------------------------------------
-- Create Application Users
-- -----------------------------------------------------------------------------
-- Main application user (used by Next.js app via PgBouncer)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'kakamalem_app') THEN
        CREATE ROLE kakamalem_app WITH
            LOGIN
            PASSWORD 'CHANGE_ME_APP_PASSWORD'
            NOSUPERUSER
            NOCREATEDB
            NOCREATEROLE
            CONNECTION LIMIT 50;
    END IF;
END
$$;

-- Migration user (for Drizzle migrations - needs more privileges)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'kakamalem_migrations') THEN
        CREATE ROLE kakamalem_migrations WITH
            LOGIN
            PASSWORD 'CHANGE_ME_MIGRATIONS_PASSWORD'
            NOSUPERUSER
            CREATEDB
            NOCREATEROLE
            CONNECTION LIMIT 5;
    END IF;
END
$$;

-- Read-only user (for analytics, reporting, debugging)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'kakamalem_readonly') THEN
        CREATE ROLE kakamalem_readonly WITH
            LOGIN
            PASSWORD 'CHANGE_ME_READONLY_PASSWORD'
            NOSUPERUSER
            NOCREATEDB
            NOCREATEROLE
            CONNECTION LIMIT 10;
    END IF;
END
$$;

-- PgBouncer authentication user
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pgbouncer') THEN
        CREATE ROLE pgbouncer WITH
            LOGIN
            PASSWORD 'CHANGE_ME_PGBOUNCER_PASSWORD'
            NOSUPERUSER
            NOCREATEDB
            NOCREATEROLE
            CONNECTION LIMIT 2;
    END IF;
END
$$;

-- Replication user (for backups)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'replication') THEN
        CREATE ROLE replication WITH
            LOGIN
            PASSWORD 'CHANGE_ME_REPLICATION_PASSWORD'
            REPLICATION
            CONNECTION LIMIT 5;
    END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- Grant Permissions
-- -----------------------------------------------------------------------------
-- Grant connect to database
GRANT CONNECT ON DATABASE kakamalem TO kakamalem_app;
GRANT CONNECT ON DATABASE kakamalem TO kakamalem_migrations;
GRANT CONNECT ON DATABASE kakamalem TO kakamalem_readonly;
GRANT CONNECT ON DATABASE kakamalem TO pgbouncer;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO kakamalem_app;
GRANT ALL ON SCHEMA public TO kakamalem_migrations;
GRANT USAGE ON SCHEMA public TO kakamalem_readonly;

-- Grant table permissions (these will apply to future tables too)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kakamalem_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO kakamalem_migrations;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO kakamalem_readonly;

-- Grant sequence permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO kakamalem_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON SEQUENCES TO kakamalem_migrations;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON SEQUENCES TO kakamalem_readonly;

-- Grant function execution
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO kakamalem_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON FUNCTIONS TO kakamalem_migrations;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO kakamalem_readonly;

-- -----------------------------------------------------------------------------
-- PgBouncer Authentication Setup
-- -----------------------------------------------------------------------------
-- Create schema for PgBouncer auth
CREATE SCHEMA IF NOT EXISTS pgbouncer;
GRANT USAGE ON SCHEMA pgbouncer TO pgbouncer;

-- Function for PgBouncer to look up user credentials
CREATE OR REPLACE FUNCTION pgbouncer.user_lookup(in_username TEXT)
RETURNS TABLE(username TEXT, password TEXT) AS
$$
BEGIN
    RETURN QUERY
    SELECT rolname::TEXT, rolpassword::TEXT
    FROM pg_authid
    WHERE rolname = in_username
    AND rolcanlogin = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to pgbouncer user
GRANT EXECUTE ON FUNCTION pgbouncer.user_lookup(TEXT) TO pgbouncer;

-- -----------------------------------------------------------------------------
-- Performance Indexes (applied after tables exist)
-- -----------------------------------------------------------------------------
-- These will be created by Drizzle, but here are some additional GIN indexes
-- for full-text search that Drizzle doesn't create

-- Run after tables exist:
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS products_search_idx
--     ON products USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- -----------------------------------------------------------------------------
-- Utility Functions
-- -----------------------------------------------------------------------------
-- Function to generate short unique IDs (for order numbers, tracking codes, etc.)
CREATE OR REPLACE FUNCTION generate_short_id(prefix TEXT DEFAULT '', length INT DEFAULT 8)
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- No I, O, 0, 1 (avoid confusion)
    result TEXT := prefix;
    i INT;
BEGIN
    FOR i IN 1..length LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'KM-' || to_char(NOW(), 'YYYY') || '-' ||
           LPAD(nextval('order_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Create sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- Function to generate affiliate codes
CREATE OR REPLACE FUNCTION generate_affiliate_code()
RETURNS TEXT AS $$
BEGIN
    RETURN generate_short_id('', 8);
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Session/Cart Cleanup Function
-- -----------------------------------------------------------------------------
-- Call this periodically to clean up expired carts
CREATE OR REPLACE FUNCTION cleanup_expired_carts()
RETURNS INT AS $$
DECLARE
    deleted_count INT;
BEGIN
    WITH deleted AS (
        DELETE FROM carts
        WHERE expires_at < NOW()
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Initial Performance Tuning Queries
-- -----------------------------------------------------------------------------
-- Run these after the app has been running to identify slow queries:
--
-- Top 10 slowest queries:
-- SELECT query, calls, total_time, mean_time, rows
-- FROM pg_stat_statements
-- ORDER BY mean_time DESC
-- LIMIT 10;
--
-- Most called queries:
-- SELECT query, calls, total_time, mean_time
-- FROM pg_stat_statements
-- ORDER BY calls DESC
-- LIMIT 10;

-- -----------------------------------------------------------------------------
-- Vacuum and Analyze Schedule (run via cron)
-- -----------------------------------------------------------------------------
-- Full vacuum should be run during low-traffic periods:
-- 0 4 * * 0 psql -U postgres -d kakamalem -c "VACUUM FULL ANALYZE;"
--
-- Regular vacuum runs automatically via autovacuum

\echo '=============================================='
\echo 'Database initialization complete!'
\echo 'Next steps:'
\echo '1. Update passwords in this script'
\echo '2. Run Drizzle migrations: pnpm db:migrate'
\echo '3. Generate PgBouncer userlist.txt'
\echo '4. Start PgBouncer service'
\echo '=============================================='
