-- Migration: Unified Delivery Zones
-- Merges delivery_zones + shipping_zones into a single unified system

-- Zone types enum
DO $$ BEGIN
  CREATE TYPE unified_zone_type AS ENUM (
    'polygon',    -- Custom drawn GeoJSON area
    'radius',     -- GPS circle
    'postal',     -- Postal code ranges
    'city',       -- City name match
    'region',     -- State/province match
    'country',    -- Country code match
    'worldwide'   -- Catch-all fallback
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Delivery method types enum
DO $$ BEGIN
  CREATE TYPE delivery_method_type AS ENUM (
    'local_delivery',  -- Same-day/next-day local
    'standard',        -- Standard shipping (3-7 days)
    'express',         -- Express shipping (1-2 days)
    'pickup',          -- Store pickup
    'custom'           -- User-defined
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Rate calculation types enum
DO $$ BEGIN
  CREATE TYPE rate_calculation_type AS ENUM (
    'flat',           -- Fixed rate
    'per_item',       -- Base + per-item fee
    'weight_based',   -- Base + per-kg fee
    'weight_tiered',  -- Tiered weight brackets
    'price_based',    -- Based on order subtotal
    'free'            -- Always free
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Main unified zones table
CREATE TABLE IF NOT EXISTS unified_delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Basic info
  name VARCHAR(100) NOT NULL,
  zone_type unified_zone_type NOT NULL,

  -- Specificity score for zone matching priority
  -- Higher = more specific = checked first
  -- polygon: 600, radius: 500, postal: 400, city: 300, region: 200, country: 100, worldwide: 10
  specificity_score INTEGER NOT NULL,

  -- Geographic definition (varies by zone_type)
  -- For 'polygon': GeoJSON Polygon geometry
  polygon_geojson JSONB,

  -- For 'radius': center point and radius
  center_lat DECIMAL(10, 8),
  center_lng DECIMAL(11, 8),
  radius_meters INTEGER,

  -- For 'country': ISO 3166-1 alpha-2 codes (e.g., ['AF', 'IR', 'PK'])
  countries JSONB DEFAULT '[]'::jsonb,
  -- For 'region': state/province names
  regions JSONB DEFAULT '[]'::jsonb,
  -- For 'city': city names
  cities JSONB DEFAULT '[]'::jsonb,
  -- For 'postal': postal code patterns (supports wildcards like "1001*")
  postal_patterns JSONB DEFAULT '[]'::jsonb,

  -- Display settings
  color VARCHAR(7) DEFAULT '#3b82f6',
  display_order INTEGER DEFAULT 0 NOT NULL,

  -- Status
  is_active BOOLEAN DEFAULT true NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT chk_radius_fields CHECK (
    zone_type != 'radius' OR (
      center_lat IS NOT NULL AND
      center_lng IS NOT NULL AND
      radius_meters > 0
    )
  ),
  CONSTRAINT chk_polygon_fields CHECK (
    zone_type != 'polygon' OR polygon_geojson IS NOT NULL
  ),
  CONSTRAINT chk_country_fields CHECK (
    zone_type != 'country' OR jsonb_array_length(countries) > 0
  )
);

-- Delivery methods per zone
CREATE TABLE IF NOT EXISTS unified_delivery_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES unified_delivery_zones(id) ON DELETE CASCADE,

  -- Method info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  method_type delivery_method_type NOT NULL DEFAULT 'standard',

  -- Delivery time estimates
  min_delivery_days INTEGER,
  max_delivery_days INTEGER,
  estimated_time VARCHAR(50),  -- "30-45 minutes" for local delivery

  -- Rate calculation
  rate_type rate_calculation_type NOT NULL DEFAULT 'flat',
  base_rate DECIMAL(12, 2) DEFAULT 0 NOT NULL,
  per_item_rate DECIMAL(12, 2),
  per_kg_rate DECIMAL(12, 2),

  -- Thresholds
  free_shipping_threshold DECIMAL(12, 2),
  min_order_amount DECIMAL(12, 2),

  -- Weight limits (for weight-based)
  min_weight_kg DECIMAL(10, 3),
  max_weight_kg DECIMAL(10, 3),

  -- Additional fees
  handling_fee DECIMAL(12, 2) DEFAULT 0,

  -- Features
  includes_insurance BOOLEAN DEFAULT false NOT NULL,
  insurance_rate DECIMAL(5, 2),  -- Percentage of order value
  includes_tracking BOOLEAN DEFAULT true NOT NULL,

  -- Pickup location (for pickup method type)
  pickup_location_name VARCHAR(255),
  pickup_location_address TEXT,
  pickup_location_lat DECIMAL(10, 8),
  pickup_location_lng DECIMAL(11, 8),

  -- Display
  display_order INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Unique constraint: one method name per zone per tenant
  CONSTRAINT unified_methods_tenant_zone_name_unique UNIQUE (tenant_id, zone_id, name)
);

-- Weight tiers for weight_tiered rate type
CREATE TABLE IF NOT EXISTS unified_weight_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  method_id UUID NOT NULL REFERENCES unified_delivery_methods(id) ON DELETE CASCADE,

  min_weight_kg DECIMAL(10, 3) NOT NULL,
  max_weight_kg DECIMAL(10, 3),  -- NULL = unlimited
  rate DECIMAL(12, 2) NOT NULL,
  per_kg_rate_in_tier DECIMAL(12, 2),  -- Additional per-kg within tier

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_unified_zones_tenant ON unified_delivery_zones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_unified_zones_tenant_active ON unified_delivery_zones(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_unified_zones_tenant_specificity ON unified_delivery_zones(tenant_id, specificity_score);
CREATE INDEX IF NOT EXISTS idx_unified_methods_zone ON unified_delivery_methods(zone_id);
CREATE INDEX IF NOT EXISTS idx_unified_methods_tenant_active ON unified_delivery_methods(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_unified_tiers_method ON unified_weight_tiers(method_id);
CREATE INDEX IF NOT EXISTS idx_unified_tiers_method_weight ON unified_weight_tiers(method_id, min_weight_kg);

-- Trigger for updated_at on zones
CREATE OR REPLACE FUNCTION update_unified_delivery_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_unified_zones_updated ON unified_delivery_zones;
CREATE TRIGGER trg_unified_zones_updated
  BEFORE UPDATE ON unified_delivery_zones
  FOR EACH ROW EXECUTE FUNCTION update_unified_delivery_timestamp();

DROP TRIGGER IF EXISTS trg_unified_methods_updated ON unified_delivery_methods;
CREATE TRIGGER trg_unified_methods_updated
  BEFORE UPDATE ON unified_delivery_methods
  FOR EACH ROW EXECUTE FUNCTION update_unified_delivery_timestamp();
