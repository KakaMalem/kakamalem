-- Add geo and device fields to platform_affiliate_clicks for production-grade tracking
-- These fields enable analytics like: clicks by country, device type, browser
-- Run with: pnpm db:migrate:custom

ALTER TABLE "platform_affiliate_clicks"
ADD COLUMN IF NOT EXISTS "country" varchar(2),
ADD COLUMN IF NOT EXISTS "city" varchar(100),
ADD COLUMN IF NOT EXISTS "region" varchar(100),
ADD COLUMN IF NOT EXISTS "device_type" varchar(20),
ADD COLUMN IF NOT EXISTS "browser" varchar(50),
ADD COLUMN IF NOT EXISTS "os" varchar(50),
ADD COLUMN IF NOT EXISTS "is_bot" boolean DEFAULT false NOT NULL;

-- Index for geo analytics
CREATE INDEX IF NOT EXISTS "platform_affiliate_clicks_country_idx" ON "platform_affiliate_clicks" ("country");

-- Index for bot filtering (exclude bots from analytics)
CREATE INDEX IF NOT EXISTS "platform_affiliate_clicks_is_bot_idx" ON "platform_affiliate_clicks" ("is_bot");

-- Composite index for deduplication queries (visitor + time window)
CREATE INDEX IF NOT EXISTS "platform_affiliate_clicks_dedup_idx" ON "platform_affiliate_clicks" ("affiliate_id", "visitor_id", "clicked_at");
