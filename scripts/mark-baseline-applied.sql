-- ============================================================================
-- MARK BASELINE MIGRATION AS APPLIED
-- ============================================================================
-- Run this ONCE in Supabase SQL Editor to mark the initial migration as applied.
-- This is needed because your database already has all tables created.
--
-- After running this, Drizzle will know that 0000_keen_sentry.sql is already
-- applied and won't try to run it again.

-- Create the drizzle schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS drizzle;

-- Create the migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash TEXT NOT NULL,
    created_at BIGINT
);

-- Insert the baseline migration record
-- This tells Drizzle that 0000_keen_sentry.sql is already applied
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES ('0000_keen_sentry', 1767712901328)
ON CONFLICT DO NOTHING;

-- Verify it was inserted
SELECT * FROM drizzle.__drizzle_migrations;
