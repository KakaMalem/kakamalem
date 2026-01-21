-- =============================================================================
-- BACKFILL USER PROFILES
-- =============================================================================
-- Creates user_profiles rows for any existing users that don't have one.
-- This is a one-time migration to fix users created before the databaseHooks
-- were implemented in Better Auth.
--
-- Safe to run multiple times - uses INSERT ... ON CONFLICT DO NOTHING
-- =============================================================================

DO $$
DECLARE
  users_without_profile INTEGER;
  profiles_created INTEGER := 0;
BEGIN
  -- Count users without profiles
  SELECT COUNT(*) INTO users_without_profile
  FROM "user" u
  WHERE NOT EXISTS (
    SELECT 1 FROM user_profiles up WHERE up.user_id = u.id
  );

  RAISE NOTICE 'Found % users without profiles', users_without_profile;

  -- Create profiles for users that don't have one
  INSERT INTO user_profiles (user_id, platform_role, preferred_currency, preferred_language, created_at, updated_at)
  SELECT
    u.id,
    'user',
    'AFN',
    'fa',
    NOW(),
    NOW()
  FROM "user" u
  WHERE NOT EXISTS (
    SELECT 1 FROM user_profiles up WHERE up.user_id = u.id
  )
  ON CONFLICT (user_id) DO NOTHING;

  GET DIAGNOSTICS profiles_created = ROW_COUNT;
  RAISE NOTICE 'Created % new user profiles', profiles_created;
END $$;
