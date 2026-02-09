-- Add enableShipping flag to tenants table for additive fulfillment model
-- This allows stores to have both GPS-based delivery zones AND shipping simultaneously

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "enable_shipping" boolean DEFAULT true NOT NULL;

-- Comment explaining the dual-mode fulfillment system
COMMENT ON COLUMN "tenants"."enable_shipping" IS 'Enable shipping for customers outside delivery zones. Both enableDeliveryZones and enableShipping can be active simultaneously for hybrid fulfillment.';
COMMENT ON COLUMN "tenants"."enable_delivery_zones" IS 'Enable GPS-based delivery zones for local delivery. Customers within zones see local delivery options.';
