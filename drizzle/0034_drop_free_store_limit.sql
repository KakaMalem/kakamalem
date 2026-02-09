-- Migration: Drop free_store_limit column
-- Description: Remove unused freeStoreLimit setting (per-store billing model doesn't need user-level store limits)

ALTER TABLE platform_settings
DROP COLUMN IF EXISTS free_store_limit;
