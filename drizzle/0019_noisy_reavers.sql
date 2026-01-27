-- =============================================================================
-- CRITICAL: Migrate sales_channel data to channel BEFORE dropping the column
-- =============================================================================
-- Map salesChannel values to new channel enum:
-- salesChannel: online, offline, phone
-- channel: online, pos, phone, marketplace, social
UPDATE orders SET channel =
  CASE
    WHEN sales_channel = 'offline' THEN 'pos'::order_channel
    WHEN sales_channel = 'online' THEN 'online'::order_channel
    WHEN sales_channel = 'phone' THEN 'phone'::order_channel
    ELSE 'online'::order_channel
  END
WHERE channel = 'online' AND sales_channel IS NOT NULL AND sales_channel != 'online';--> statement-breakpoint

-- Now safe to drop the old column
DROP INDEX "orders_tenant_sales_channel_idx";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "sales_channel";--> statement-breakpoint
DROP TYPE "public"."sales_channel";