# Unified Delivery System - Implementation Plan

> **Status:** Planning Phase
> **Version:** 2.0 (Refined)
> **Created:** February 2026
> **Last Updated:** February 2026

---

## Executive Summary

This document outlines a comprehensive plan to unify Kaka Malem's two separate delivery systems (GPS-based local delivery + country-based shipping) into a single, cohesive system with an interactive map-based configuration UI.

### Key Goals

1. **Unify** delivery zones + shipping zones into one system
2. **Add** interactive country selection with hover effects on the map
3. **Fix** identified performance issues (duplicate API calls, zone checking)
4. **Improve** checkout UX with clear delivery option comparison
5. **Maintain** backward compatibility during migration

### Estimated Timeline

| Phase     | Duration      | Description                |
| --------- | ------------- | -------------------------- |
| Phase 1   | 1-2 weeks     | Interactive map components |
| Phase 2   | 1-2 weeks     | Unified zone editor        |
| Phase 3   | 1 week        | Checkout integration       |
| Phase 4   | 1 week        | Migration & cleanup        |
| **Total** | **4-6 weeks** | Core implementation        |

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Identified Issues](#2-identified-issues)
3. [Proposed Architecture](#3-proposed-architecture)
4. [Interactive Map Specification](#4-interactive-map-specification)
5. [Database Schema](#5-database-schema)
6. [Component Specifications](#6-component-specifications)
7. [Checkout Integration](#7-checkout-integration)
8. [Performance Optimizations](#8-performance-optimizations)
9. [Migration Strategy](#9-migration-strategy)
10. [Edge Cases & Error Handling](#10-edge-cases--error-handling)
11. [Testing Strategy](#11-testing-strategy)
12. [Implementation Phases](#12-implementation-phases)

---

## 1. Current State Analysis

### Existing Two-System Architecture

Kaka Malem currently has **two separate delivery systems** that don't communicate:

#### System A: Delivery Zones (GPS-Based)

| Aspect           | Details                                 |
| ---------------- | --------------------------------------- |
| **Table**        | `delivery_zones`                        |
| **Purpose**      | Local delivery within geographic radius |
| **Zone Types**   | Circle (radius) or Polygon (future)     |
| **Matching**     | GPS coordinates via Turf.js             |
| **UI Component** | `DeliveryZonesManager`                  |
| **Location**     | `components/dashboard/delivery-zones/`  |

**Data Model:**

```typescript
{
  id: uuid,
  tenantId: uuid,
  name: string,           // "Kabul City Center"
  zoneType: "circle",     // or "polygon"
  centerLat: number,
  centerLng: number,
  radiusMeters: number,   // 5000 = 5km
  deliveryFee: decimal,   // 50 AFN
  minOrderAmount: decimal,
  freeShippingThreshold: decimal,
  estimatedDeliveryTime: string,  // "30-45 minutes"
  color: string,          // "#3b82f6"
  isActive: boolean
}
```

#### System B: Shipping Zones (Country-Based)

| Aspect           | Details                                             |
| ---------------- | --------------------------------------------------- |
| **Table**        | `shipping_zones` + `shipping_methods`               |
| **Purpose**      | Regional/international shipping                     |
| **Zone Types**   | Countries, states, cities, postal codes             |
| **Matching**     | Specificity scoring via Nominatim reverse geocoding |
| **UI Component** | `ShippingRatesManager`                              |
| **Location**     | `components/dashboard/delivery-shipping/`           |

**Data Model:**

```typescript
// shipping_zones
{
  id: uuid,
  tenantId: uuid,
  name: string,           // "Middle East"
  countries: string[],    // ["AF", "PK", "IR"]
  states: string[],       // ["Kabul", "Herat"]
  cities: string[],
  postalCodes: string[],
  priority: number,
  isActive: boolean
}

// shipping_methods (linked to zone)
{
  id: uuid,
  zoneId: uuid,
  name: string,           // "Standard Shipping"
  rateType: "flat" | "per_item" | "weight_based",
  baseRate: decimal,
  minDeliveryDays: number,
  maxDeliveryDays: number,
  freeShippingThreshold: decimal
}
```

### Current Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      CHECKOUT FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │ SectionDelivery │     │ SectionShipping │                   │
│  │ (Address Input) │────▶│ (Method Select) │                   │
│  └────────┬────────┘     └────────┬────────┘                   │
│           │                       │                             │
│           ▼                       ▼                             │
│  ┌─────────────────┐     ┌─────────────────────────┐           │
│  │ LocationPicker  │     │ calculateShippingAction │           │
│  │ - Shows zones   │     │ - Fetches zones AGAIN   │ ◀── Issue │
│  │ - Haversine     │     │ - Nominatim lookup      │           │
│  │   check (client)│     │ - Turf.js check (server)│ ◀── Issue │
│  └─────────────────┘     └─────────────────────────┘           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Component           | Technology       | Notes                       |
| ------------------- | ---------------- | --------------------------- |
| Map Library         | Leaflet 1.9.4    | Loaded from CDN dynamically |
| Geospatial (Server) | Turf.js 7.3.2    | Point-in-polygon, distance  |
| Geospatial (Client) | Custom Haversine | Different from server!      |
| Geocoding           | Nominatim (OSM)  | No caching, rate limits     |
| Tiles               | OpenStreetMap    | Free, no API key            |
| State               | Zustand          | `useCheckoutStore`          |

---

## 2. Identified Issues

### 2.1 Code Duplication

| Issue               | Location 1                               | Location 2                                 | Impact                     |
| ------------------- | ---------------------------------------- | ------------------------------------------ | -------------------------- |
| Zone checking logic | `location-picker.tsx:84-123` (Haversine) | `delivery-zone-check.ts:105-123` (Turf.js) | Different results possible |
| Reverse geocoding   | `location-picker.tsx:504`                | `shipping.ts:27`                           | Duplicate API calls        |
| Zone fetching       | `SectionDelivery` (prop)                 | `calculateShippingAction` (re-fetch)       | Wasted DB queries          |

### 2.2 UX Confusion

1. **Ambiguous terminology:** "Shipping" section handles both local delivery AND shipping
2. **No visual comparison:** Can't easily compare speed vs cost of options
3. **Hidden zone info:** Delivery details only shown in tooltips
4. **No indication:** Which method is cheapest/fastest not highlighted

### 2.3 Performance Issues

```typescript
// Problem 1: Duplicate Nominatim calls (no caching)
// shipping.ts line 27 - called every checkout step

// Problem 2: Zones fetched twice
// - SectionDelivery receives as prop
// - calculateShippingAction fetches again (lines 314, 399)

// Problem 3: Leaflet CDN loaded per component
// location-picker.tsx lines 435-451 - no deduplication
```

### 2.4 Technical Debt

| Issue                   | Location                  | Status                  |
| ----------------------- | ------------------------- | ----------------------- |
| Cart weight not tracked | `checkout.ts:385`         | TODO comment            |
| Weight tiers incomplete | `shipping.ts:362-367`     | Falls back to base rate |
| Afghanistan-only search | `location-picker.tsx:463` | Hardcoded countrycode   |
| No test coverage        | Entire delivery system    | Missing                 |

### 2.5 Missing Features

- [ ] Visual country selection on map
- [ ] Hover effects on country boundaries
- [ ] Continent/region bulk selection
- [ ] Zone templates (presets)
- [ ] Rate comparison visualization
- [ ] Cart weight for weight-based shipping

---

## 3. Proposed Architecture

### 3.1 Unified Zone Model

Merge both systems into a **single unified zone** concept:

```
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED DELIVERY ZONE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Zone Type (determines how matching works):                     │
│  ├─ POLYGON   → Custom drawn GeoJSON area (most specific)      │
│  ├─ RADIUS    → GPS circle around a point                      │
│  ├─ POSTAL    → Postal/ZIP code ranges                         │
│  ├─ CITY      → City name matching                             │
│  ├─ REGION    → State/province matching                        │
│  ├─ COUNTRY   → Country ISO code matching (least specific)     │
│  └─ WORLDWIDE → Catch-all fallback ("Rest of World")           │
│                                                                 │
│  Each zone has 1+ DELIVERY METHODS:                            │
│  ├─ Local Delivery (same-day, fee-based)                       │
│  ├─ Standard Shipping (3-5 days)                               │
│  ├─ Express Shipping (1-2 days)                                │
│  ├─ Store Pickup (free)                                        │
│  └─ Custom method...                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Zone Hierarchy & Matching

**Specificity Scoring Algorithm:**

```typescript
const SPECIFICITY_SCORES = {
  polygon: 600, // Custom drawn = most specific
  radius: 500, // GPS circle (smaller = more specific)
  postal: 400, // Postal code match
  city: 300, // City name match
  region: 200, // State/province match
  country: 100, // Country code match
  worldwide: 10, // Catch-all fallback
};

// Radius bonus: smaller radius = more specific
// e.g., 2km radius gets +48 bonus, 50km gets +0
const radiusBonus = (50000 - Math.min(radiusMeters, 50000)) / 1000;
```

**Matching Flow:**

```
Customer Location: { lat: 34.5553, lng: 69.2075, country: "AF", city: "Kabul" }

1. Check all active zones
2. Score each match:
   - "Kabul Downtown" (radius 3km, contains point) → 500 + 47 = 547
   - "Kabul City" (radius 15km, contains point) → 500 + 35 = 535
   - "Afghanistan" (country: ["AF"]) → 100
   - "Rest of World" (worldwide: true) → 10

3. Return highest scoring zone: "Kabul Downtown"
4. Display ALL matching zones' methods for customer choice
```

### 3.3 UI Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  UNIFIED DELIVERY CONFIGURATION                    [+ Add Zone] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ Zone List (sidebar) ──────┐  ┌─ Map (main area) ───────┐ │
│  │                            │  │                          │ │
│  │ 🗺️ Kabul Downtown          │  │  ┌─────────────────────┐ │ │
│  │    📍 3km radius • 50 AFN  │  │  │                     │ │ │
│  │    ✓ Active                │  │  │   [Interactive      │ │ │
│  │                            │  │  │    World Map]       │ │ │
│  │ 🗺️ Kabul City              │  │  │                     │ │ │
│  │    📍 15km radius • 100 AFN│  │  │   • Hover countries │ │ │
│  │    ✓ Active                │  │  │   • Click to select │ │ │
│  │                            │  │  │   • Draw polygons   │ │ │
│  │ 🌍 Afghanistan             │  │  │   • Create circles  │ │ │
│  │    🇦🇫 1 country • 150 AFN │  │  │                     │ │ │
│  │    ✓ Active                │  │  └─────────────────────┘ │ │
│  │                            │  │                          │ │
│  │ 🌍 Middle East             │  │  [Zoom: +] [-]          │ │
│  │    🇦🇪🇸🇦🇵🇰 +5 • 500 AFN    │  │  [Search: ___________]  │ │
│  │    ✓ Active                │  │  [Layers: ☑ Countries   │ │
│  │                            │  │           ☑ Local zones]│ │
│  │ 🌐 Rest of World           │  │                          │ │
│  │    Catch-all • 1000 AFN   │  │                          │ │
│  │    ✓ Active                │  └──────────────────────────┘ │
│  │                            │                              │
│  └────────────────────────────┘                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Interactive Map Specification

### 4.1 Technology Decision

**Recommendation: Extend existing Leaflet** (not add new library)

| Criterion               | Leaflet + GeoJSON  | react-simple-maps                 |
| ----------------------- | ------------------ | --------------------------------- |
| Already in codebase     | ✅ Yes             | ❌ No (new dep)                   |
| Polygon drawing         | ✅ Leaflet.draw    | ❌ No support                     |
| Unified local + country | ✅ Same component  | ❌ Separate maps                  |
| Performance             | ✅ Canvas renderer | ⚠️ SVG (slower for many elements) |
| Bundle size             | ✅ Already loaded  | ⚠️ +30-40KB                       |
| Learning curve          | ✅ Team familiar   | ⚠️ New API                        |

### 4.2 GeoJSON Data

**Source:** Natural Earth Data (public domain)

```typescript
// lib/delivery/geojson/index.ts

export const GEOJSON_CONFIG = {
  // Low resolution for world view (fast loading, ~500KB)
  worldLow: "/data/geojson/countries-110m.geojson",

  // Medium resolution for zoomed regions (~2MB)
  worldMedium: "/data/geojson/countries-50m.geojson",

  // Afghanistan provinces (detailed, ~100KB)
  afghanistanProvinces: "/data/geojson/afghanistan-provinces.geojson",

  // Common regions for bulk selection
  regions: {
    middleEast: [
      "AF",
      "IR",
      "PK",
      "AE",
      "SA",
      "IQ",
      "SY",
      "JO",
      "LB",
      "YE",
      "OM",
      "KW",
      "BH",
      "QA",
    ],
    centralAsia: ["AF", "KZ", "UZ", "TM", "TJ", "KG"],
    southAsia: ["AF", "PK", "IN", "BD", "LK", "NP", "BT", "MV"],
    gulfStates: ["AE", "SA", "KW", "BH", "QA", "OM"],
  },
};

// Lazy load with caching
export async function loadCountriesGeoJSON(
  resolution: "low" | "medium" = "low"
) {
  const cacheKey = `geojson-countries-${resolution}`;

  // Check session storage first
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);

  const url =
    resolution === "low" ? GEOJSON_CONFIG.worldLow : GEOJSON_CONFIG.worldMedium;

  const response = await fetch(url);
  const data = await response.json();

  // Cache in session storage
  sessionStorage.setItem(cacheKey, JSON.stringify(data));

  return data;
}
```

### 4.3 Country Layer Component

```typescript
// components/dashboard/delivery/map/country-layer.tsx

import { useRef, useEffect, useCallback } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import type { Feature, FeatureCollection } from 'geojson';
import type L from 'leaflet';

interface CountryLayerProps {
  data: FeatureCollection;
  selectedCountries: string[];
  onCountryToggle: (code: string, name: string) => void;
  zoneColor?: string;
  disabled?: boolean;
}

export function CountryLayer({
  data,
  selectedCountries,
  onCountryToggle,
  zoneColor = '#3b82f6',
  disabled = false,
}: CountryLayerProps) {
  const geoJsonRef = useRef<L.GeoJSON | null>(null);
  const map = useMap();

  // Style function - called for each feature
  const getStyle = useCallback((feature: Feature | undefined) => {
    if (!feature?.properties) return {};

    const code = feature.properties.ISO_A2 || feature.properties.iso_a2;
    const isSelected = selectedCountries.includes(code);

    return {
      fillColor: isSelected ? zoneColor : 'transparent',
      fillOpacity: isSelected ? 0.35 : 0,
      color: isSelected ? zoneColor : '#94a3b8',
      weight: isSelected ? 2.5 : 0.5,
      opacity: 1,
    };
  }, [selectedCountries, zoneColor]);

  // Update styles when selection changes
  useEffect(() => {
    if (geoJsonRef.current) {
      geoJsonRef.current.setStyle(getStyle);
    }
  }, [selectedCountries, getStyle]);

  // Attach event handlers to each feature
  const onEachFeature = useCallback((feature: Feature, layer: L.Layer) => {
    const props = feature.properties;
    if (!props) return;

    const code = props.ISO_A2 || props.iso_a2;
    const name = props.ADMIN || props.name || props.NAME;

    // Tooltip
    layer.bindTooltip(name, {
      sticky: true,
      direction: 'top',
      className: 'country-tooltip',
      offset: [0, -10],
    });

    // Event handlers
    layer.on({
      mouseover: (e) => {
        if (disabled) return;

        const target = e.target as L.Path;
        const isSelected = selectedCountries.includes(code);

        if (!isSelected) {
          target.setStyle({
            fillColor: '#e2e8f0',
            fillOpacity: 0.4,
            weight: 1.5,
            color: '#64748b',
          });
        } else {
          target.setStyle({
            fillOpacity: 0.5,
            weight: 3,
          });
        }
        target.bringToFront();
      },

      mouseout: (e) => {
        if (disabled) return;
        const target = e.target as L.Path;
        // Reset to computed style
        target.setStyle(getStyle(feature));
      },

      click: () => {
        if (disabled) return;
        onCountryToggle(code, name);
      },
    });
  }, [selectedCountries, onCountryToggle, getStyle, disabled]);

  return (
    <GeoJSON
      ref={geoJsonRef}
      data={data}
      style={getStyle}
      onEachFeature={onEachFeature}
    />
  );
}
```

### 4.4 CSS Styling

```css
/* globals.css additions */

/* Country tooltip */
.country-tooltip {
  background: oklch(0.18 0.01 260 / 0.95);
  border: 1px solid oklch(0.35 0.02 260);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 14px;
  font-weight: 500;
  color: white;
  box-shadow: 0 4px 16px oklch(0 0 0 / 0.25);
  backdrop-filter: blur(4px);
}

.country-tooltip::before {
  border-top-color: oklch(0.18 0.01 260 / 0.95);
}

/* Smooth transitions for map elements */
.leaflet-interactive {
  transition:
    fill-opacity 120ms ease-out,
    stroke-width 120ms ease-out,
    fill 120ms ease-out,
    stroke 120ms ease-out;
}

/* Cursor change on hoverable countries */
.leaflet-container.countries-selectable .leaflet-interactive {
  cursor: pointer;
}

/* Selected country highlight */
.leaflet-container .country-selected {
  filter: drop-shadow(0 0 8px currentColor);
}

/* Zone editor map container */
.zone-editor-map {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid oklch(0.85 0.01 260);
}

/* Drawing mode indicator */
.zone-editor-map.drawing-mode {
  cursor: crosshair !important;
}
.zone-editor-map.drawing-mode .leaflet-interactive {
  cursor: crosshair !important;
}
```

### 4.5 Map Controls

```typescript
// components/dashboard/delivery/map/map-controls.tsx

interface MapControlsProps {
  onSearch: (query: string) => void;
  onBulkSelect: (region: string) => void;
  onClearSelection: () => void;
  selectedCount: number;
  layers: {
    countries: boolean;
    localZones: boolean;
  };
  onToggleLayer: (layer: 'countries' | 'localZones') => void;
}

export function MapControls({
  onSearch,
  onBulkSelect,
  onClearSelection,
  selectedCount,
  layers,
  onToggleLayer,
}: MapControlsProps) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
      {/* Search */}
      <div className="bg-white rounded-lg shadow-md p-2">
        <Input
          placeholder="Search country..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch(searchQuery)}
          className="w-48"
        />
      </div>

      {/* Bulk Selection */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" className="shadow-md">
            <Globe className="w-4 h-4 mr-2" />
            Regions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => onBulkSelect('middleEast')}>
            Middle East (14 countries)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onBulkSelect('centralAsia')}>
            Central Asia (6 countries)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onBulkSelect('southAsia')}>
            South Asia (8 countries)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onBulkSelect('gulfStates')}>
            Gulf States (6 countries)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onClearSelection}>
            Clear All
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Selection indicator */}
      {selectedCount > 0 && (
        <Badge variant="secondary" className="shadow-md justify-center">
          {selectedCount} selected
        </Badge>
      )}

      {/* Layer toggles */}
      <div className="bg-white rounded-lg shadow-md p-2 space-y-1">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={layers.countries}
            onCheckedChange={() => onToggleLayer('countries')}
          />
          Countries
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={layers.localZones}
            onCheckedChange={() => onToggleLayer('localZones')}
          />
          Local Zones
        </label>
      </div>
    </div>
  );
}
```

---

## 5. Database Schema

### 5.1 New Tables

```sql
-- Migration: 0032_unified_delivery_zones.sql

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
CREATE TABLE unified_delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Basic info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  zone_type unified_zone_type NOT NULL,

  -- Geographic definition (varies by zone_type)
  -- For 'country': ISO 3166-1 alpha-2 codes
  countries JSONB DEFAULT '[]'::jsonb,
  -- For 'region': state/province names
  regions JSONB DEFAULT '[]'::jsonb,
  -- For 'city': city names
  cities JSONB DEFAULT '[]'::jsonb,
  -- For 'postal': postal code patterns (supports ranges like "1001-1010")
  postal_codes JSONB DEFAULT '[]'::jsonb,
  -- For 'radius': center point
  center_lat DECIMAL(10, 7),
  center_lng DECIMAL(10, 7),
  radius_meters INTEGER,
  -- For 'polygon': GeoJSON Polygon geometry
  polygon_geojson JSONB,
  -- For 'worldwide': no additional fields needed

  -- Display settings
  color VARCHAR(7) DEFAULT '#3b82f6',
  icon VARCHAR(50),  -- Optional emoji/icon

  -- Matching priority (manual override)
  priority INTEGER DEFAULT 0,
  -- Display order in list
  display_order INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

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
CREATE TABLE unified_delivery_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES unified_delivery_zones(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Method info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  method_type delivery_method_type NOT NULL DEFAULT 'standard',

  -- Delivery time estimates
  min_delivery_minutes INTEGER,  -- For local delivery (30, 60, etc.)
  max_delivery_minutes INTEGER,
  min_delivery_days INTEGER,     -- For shipping (1, 3, 5, etc.)
  max_delivery_days INTEGER,
  estimated_delivery_text VARCHAR(100),  -- "30-45 minutes", "2-3 business days"

  -- Rate calculation
  rate_type rate_calculation_type NOT NULL DEFAULT 'flat',
  base_rate DECIMAL(10, 2) DEFAULT 0,
  per_item_rate DECIMAL(10, 2),
  per_kg_rate DECIMAL(10, 2),

  -- Thresholds
  free_shipping_threshold DECIMAL(10, 2),
  min_order_amount DECIMAL(10, 2),

  -- Weight limits (for weight-based)
  min_weight_kg DECIMAL(10, 3),
  max_weight_kg DECIMAL(10, 3),

  -- Additional fees
  handling_fee DECIMAL(10, 2) DEFAULT 0,

  -- Features
  includes_tracking BOOLEAN DEFAULT false,
  includes_insurance BOOLEAN DEFAULT false,
  insurance_rate DECIMAL(5, 4),  -- e.g., 0.02 = 2% of order value

  -- Display
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weight tiers for weight_tiered rate type
CREATE TABLE unified_weight_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method_id UUID NOT NULL REFERENCES unified_delivery_methods(id) ON DELETE CASCADE,

  min_weight_kg DECIMAL(10, 3) NOT NULL,
  max_weight_kg DECIMAL(10, 3),  -- NULL = unlimited
  flat_rate DECIMAL(10, 2) NOT NULL,
  per_kg_rate DECIMAL(10, 2) DEFAULT 0,  -- Additional per-kg within tier

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_unified_zones_tenant ON unified_delivery_zones(tenant_id);
CREATE INDEX idx_unified_zones_active ON unified_delivery_zones(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX idx_unified_zones_type ON unified_delivery_zones(zone_type);
CREATE INDEX idx_unified_methods_zone ON unified_delivery_methods(zone_id);
CREATE INDEX idx_unified_methods_active ON unified_delivery_methods(zone_id, is_active) WHERE is_active = true;
CREATE INDEX idx_unified_tiers_method ON unified_weight_tiers(method_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_unified_zones_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_unified_zones_updated
  BEFORE UPDATE ON unified_delivery_zones
  FOR EACH ROW EXECUTE FUNCTION update_unified_zones_timestamp();

CREATE TRIGGER trg_unified_methods_updated
  BEFORE UPDATE ON unified_delivery_methods
  FOR EACH ROW EXECUTE FUNCTION update_unified_zones_timestamp();
```

### 5.2 Drizzle Schema

```typescript
// lib/db/schema.ts additions

import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  text,
  decimal,
  integer,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const unifiedZoneTypeEnum = pgEnum("unified_zone_type", [
  "polygon",
  "radius",
  "postal",
  "city",
  "region",
  "country",
  "worldwide",
]);

export const deliveryMethodTypeEnum = pgEnum("delivery_method_type", [
  "local_delivery",
  "standard",
  "express",
  "pickup",
  "custom",
]);

export const rateCalculationTypeEnum = pgEnum("rate_calculation_type", [
  "flat",
  "per_item",
  "weight_based",
  "weight_tiered",
  "price_based",
  "free",
]);

export const unifiedDeliveryZones = pgTable("unified_delivery_zones", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  zoneType: unifiedZoneTypeEnum("zone_type").notNull(),

  // Geographic fields
  countries: jsonb("countries").default([]),
  regions: jsonb("regions").default([]),
  cities: jsonb("cities").default([]),
  postalCodes: jsonb("postal_codes").default([]),
  centerLat: decimal("center_lat", { precision: 10, scale: 7 }),
  centerLng: decimal("center_lng", { precision: 10, scale: 7 }),
  radiusMeters: integer("radius_meters"),
  polygonGeojson: jsonb("polygon_geojson"),

  // Display
  color: varchar("color", { length: 7 }).default("#3b82f6"),
  icon: varchar("icon", { length: 50 }),
  priority: integer("priority").default(0),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const unifiedDeliveryMethods = pgTable("unified_delivery_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  zoneId: uuid("zone_id")
    .notNull()
    .references(() => unifiedDeliveryZones.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  methodType: deliveryMethodTypeEnum("method_type")
    .notNull()
    .default("standard"),

  // Time estimates
  minDeliveryMinutes: integer("min_delivery_minutes"),
  maxDeliveryMinutes: integer("max_delivery_minutes"),
  minDeliveryDays: integer("min_delivery_days"),
  maxDeliveryDays: integer("max_delivery_days"),
  estimatedDeliveryText: varchar("estimated_delivery_text", { length: 100 }),

  // Rate calculation
  rateType: rateCalculationTypeEnum("rate_type").notNull().default("flat"),
  baseRate: decimal("base_rate", { precision: 10, scale: 2 }).default("0"),
  perItemRate: decimal("per_item_rate", { precision: 10, scale: 2 }),
  perKgRate: decimal("per_kg_rate", { precision: 10, scale: 2 }),

  // Thresholds
  freeShippingThreshold: decimal("free_shipping_threshold", {
    precision: 10,
    scale: 2,
  }),
  minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }),

  // Weight limits
  minWeightKg: decimal("min_weight_kg", { precision: 10, scale: 3 }),
  maxWeightKg: decimal("max_weight_kg", { precision: 10, scale: 3 }),

  // Fees & features
  handlingFee: decimal("handling_fee", { precision: 10, scale: 2 }).default(
    "0"
  ),
  includesTracking: boolean("includes_tracking").default(false),
  includesInsurance: boolean("includes_insurance").default(false),
  insuranceRate: decimal("insurance_rate", { precision: 5, scale: 4 }),

  // Display
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Relations
export const unifiedDeliveryZonesRelations = relations(
  unifiedDeliveryZones,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [unifiedDeliveryZones.tenantId],
      references: [tenants.id],
    }),
    methods: many(unifiedDeliveryMethods),
  })
);

export const unifiedDeliveryMethodsRelations = relations(
  unifiedDeliveryMethods,
  ({ one }) => ({
    zone: one(unifiedDeliveryZones, {
      fields: [unifiedDeliveryMethods.zoneId],
      references: [unifiedDeliveryZones.id],
    }),
  })
);
```

---

## 6. Component Specifications

### 6.1 File Structure

```
components/dashboard/delivery/
├── unified-delivery-manager.tsx      # Main page container
├── zone-list/
│   ├── index.tsx                     # Zone list sidebar
│   ├── zone-card.tsx                 # Individual zone card
│   ├── zone-methods-list.tsx         # Methods within zone
│   └── empty-state.tsx               # No zones placeholder
├── zone-editor/
│   ├── index.tsx                     # Create/edit dialog
│   ├── zone-type-selector.tsx        # Type selection step
│   ├── country-selector.tsx          # Country multi-select
│   ├── local-zone-editor.tsx         # Radius/polygon editor
│   ├── method-editor.tsx             # Add/edit delivery method
│   └── rate-calculator-form.tsx      # Rate configuration
├── map/
│   ├── index.tsx                     # Map container
│   ├── country-layer.tsx             # GeoJSON countries
│   ├── local-zones-layer.tsx         # Radius/polygon zones
│   ├── drawing-controls.tsx          # Leaflet.draw integration
│   ├── map-controls.tsx              # Search, layers, bulk select
│   └── map-legend.tsx                # Zone color legend
└── hooks/
    ├── use-geojson.ts                # Load & cache GeoJSON
    ├── use-zone-matching.ts          # Client-side zone check
    ├── use-drawing-mode.ts           # Drawing state management
    └── use-delivery-zones.ts         # Zone CRUD operations

lib/delivery/
├── index.ts                          # Main exports
├── zone-matcher.ts                   # Unified matching algorithm
├── rate-calculator.ts                # Rate calculation logic
├── geojson/
│   ├── index.ts                      # GeoJSON loader
│   └── regions.ts                    # Region presets
└── types.ts                          # TypeScript types

lib/actions/
└── unified-delivery.ts               # Server actions

lib/validations/
└── unified-delivery.ts               # Zod schemas
```

### 6.2 Zone Card Component

```typescript
// components/dashboard/delivery/zone-list/zone-card.tsx

interface ZoneCardProps {
  zone: UnifiedDeliveryZone & { methods: UnifiedDeliveryMethod[] };
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}

export function ZoneCard({
  zone,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onToggleActive,
}: ZoneCardProps) {
  const zoneIcon = getZoneIcon(zone.zoneType);
  const locationSummary = getLocationSummary(zone);
  const cheapestMethod = getCheapestMethod(zone.methods);

  return (
    <div
      className={cn(
        "group relative rounded-xl border p-4 transition-all cursor-pointer",
        isSelected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border hover:border-primary/50 hover:bg-muted/30"
      )}
      onClick={onSelect}
    >
      {/* Color indicator */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ backgroundColor: zone.color }}
      />

      <div className="flex items-start gap-3 pl-2">
        {/* Icon */}
        <div className="text-2xl">{zoneIcon}</div>

        <div className="flex-1 min-w-0">
          {/* Name & status */}
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{zone.name}</h3>
            {!zone.isActive && (
              <Badge variant="secondary" className="text-xs">Inactive</Badge>
            )}
          </div>

          {/* Location summary */}
          <p className="text-sm text-muted-foreground truncate">
            {locationSummary}
          </p>

          {/* Methods summary */}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-xs">
              {zone.methods.length} method{zone.methods.length !== 1 ? 's' : ''}
            </Badge>
            {cheapestMethod && (
              <span className="text-xs text-muted-foreground">
                from {formatCurrency(cheapestMethod.baseRate, 'AFN')}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Zone
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleActive}>
              {zone.isActive ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Deactivate
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Activate
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Zone
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function getZoneIcon(type: UnifiedZoneType): string {
  const icons: Record<UnifiedZoneType, string> = {
    polygon: '📐',
    radius: '📍',
    postal: '📮',
    city: '🏙️',
    region: '🗺️',
    country: '🌍',
    worldwide: '🌐',
  };
  return icons[type];
}

function getLocationSummary(zone: UnifiedDeliveryZone): string {
  switch (zone.zoneType) {
    case 'radius':
      return `${formatRadius(zone.radiusMeters!)} radius`;
    case 'polygon':
      return 'Custom area';
    case 'country':
      const countries = zone.countries as string[];
      if (countries.length <= 3) {
        return countries.map(c => getCountryFlag(c)).join(' ');
      }
      return `${countries.slice(0, 2).map(c => getCountryFlag(c)).join(' ')} +${countries.length - 2} more`;
    case 'region':
      return (zone.regions as string[]).join(', ');
    case 'city':
      return (zone.cities as string[]).join(', ');
    case 'worldwide':
      return 'All other locations';
    default:
      return '';
  }
}
```

### 6.3 Zone Editor Dialog

```typescript
// components/dashboard/delivery/zone-editor/index.tsx

interface ZoneEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zone?: UnifiedDeliveryZone;  // If editing
  onSave: (zone: ZoneFormData) => Promise<void>;
}

type EditorStep = 'type' | 'location' | 'methods' | 'review';

export function ZoneEditor({ open, onOpenChange, zone, onSave }: ZoneEditorProps) {
  const [step, setStep] = useState<EditorStep>(zone ? 'location' : 'type');
  const [formData, setFormData] = useState<Partial<ZoneFormData>>(
    zone ? zoneToFormData(zone) : {}
  );
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!zone;
  const title = isEditing ? `Edit "${zone.name}"` : 'Create Delivery Zone';

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData as ZoneFormData);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {step === 'type' && 'Choose the type of delivery zone'}
            {step === 'location' && 'Define where this zone applies'}
            {step === 'methods' && 'Add delivery methods for this zone'}
            {step === 'review' && 'Review and save your zone'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex gap-2 px-1">
          {(['type', 'location', 'methods', 'review'] as EditorStep[]).map((s, i) => (
            <div
              key={s}
              className={cn(
                "flex-1 h-1 rounded-full transition-colors",
                step === s ? "bg-primary" :
                getStepIndex(step) > i ? "bg-primary/50" : "bg-muted"
              )}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto py-4">
          {step === 'type' && (
            <ZoneTypeSelector
              selected={formData.zoneType}
              onSelect={(type) => {
                setFormData({ ...formData, zoneType: type });
                setStep('location');
              }}
            />
          )}

          {step === 'location' && formData.zoneType && (
            <ZoneLocationEditor
              type={formData.zoneType}
              value={formData}
              onChange={(data) => setFormData({ ...formData, ...data })}
            />
          )}

          {step === 'methods' && (
            <ZoneMethodsEditor
              methods={formData.methods || []}
              onChange={(methods) => setFormData({ ...formData, methods })}
            />
          )}

          {step === 'review' && (
            <ZoneReview data={formData as ZoneFormData} />
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="gap-2">
          {step !== 'type' && (
            <Button variant="outline" onClick={() => setStep(getPreviousStep(step))}>
              Back
            </Button>
          )}

          {step !== 'review' ? (
            <Button
              onClick={() => setStep(getNextStep(step))}
              disabled={!isStepValid(step, formData)}
            >
              Continue
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {isEditing ? 'Save Changes' : 'Create Zone'}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 7. Checkout Integration

### 7.1 Unified Matching Flow

```typescript
// lib/delivery/zone-matcher.ts

import * as turf from "@turf/turf";
import type {
  UnifiedDeliveryZone,
  UnifiedDeliveryMethod,
} from "@/lib/db/schema";

export interface ZoneMatchResult {
  zone: UnifiedDeliveryZone;
  methods: UnifiedDeliveryMethod[];
  specificity: number;
  matchReason: string; // "Within 3km radius", "Country: Afghanistan", etc.
}

export interface MatchLocationInput {
  lat: number;
  lng: number;
  country?: string; // ISO code (from reverse geocode)
  region?: string; // State/province
  city?: string;
  postalCode?: string;
}

const SPECIFICITY_BASE = {
  polygon: 600,
  radius: 500,
  postal: 400,
  city: 300,
  region: 200,
  country: 100,
  worldwide: 10,
} as const;

export function matchLocationToZones(
  location: MatchLocationInput,
  zones: (UnifiedDeliveryZone & { methods: UnifiedDeliveryMethod[] })[]
): ZoneMatchResult[] {
  const activeZones = zones.filter((z) => z.isActive);
  const matches: ZoneMatchResult[] = [];

  for (const zone of activeZones) {
    const matchResult = checkZoneMatch(location, zone);

    if (matchResult.isMatch) {
      matches.push({
        zone,
        methods: zone.methods.filter((m) => m.isActive),
        specificity: matchResult.specificity + (zone.priority || 0),
        matchReason: matchResult.reason,
      });
    }
  }

  // Sort by specificity (highest first)
  return matches.sort((a, b) => b.specificity - a.specificity);
}

function checkZoneMatch(
  location: MatchLocationInput,
  zone: UnifiedDeliveryZone
): { isMatch: boolean; specificity: number; reason: string } {
  const noMatch = { isMatch: false, specificity: 0, reason: "" };

  switch (zone.zoneType) {
    case "polygon": {
      if (!zone.polygonGeojson) return noMatch;

      const point = turf.point([location.lng, location.lat]);
      const polygon = zone.polygonGeojson as GeoJSON.Polygon;
      const isInside = turf.booleanPointInPolygon(point, polygon);

      return isInside
        ? {
            isMatch: true,
            specificity: SPECIFICITY_BASE.polygon,
            reason: "Within custom area",
          }
        : noMatch;
    }

    case "radius": {
      if (!zone.centerLat || !zone.centerLng || !zone.radiusMeters)
        return noMatch;

      const from = turf.point([location.lng, location.lat]);
      const to = turf.point([Number(zone.centerLng), Number(zone.centerLat)]);
      const distance = turf.distance(from, to, { units: "meters" });

      if (distance <= zone.radiusMeters) {
        // Smaller radius = more specific
        const radiusBonus = Math.floor(
          (50000 - Math.min(zone.radiusMeters, 50000)) / 1000
        );
        return {
          isMatch: true,
          specificity: SPECIFICITY_BASE.radius + radiusBonus,
          reason: `Within ${formatRadius(zone.radiusMeters)} radius`,
        };
      }
      return noMatch;
    }

    case "postal": {
      if (!location.postalCode) return noMatch;
      const postalCodes = zone.postalCodes as string[];

      const matches = postalCodes.some((pattern) =>
        matchPostalCode(location.postalCode!, pattern)
      );

      return matches
        ? {
            isMatch: true,
            specificity: SPECIFICITY_BASE.postal,
            reason: `Postal code match`,
          }
        : noMatch;
    }

    case "city": {
      if (!location.city) return noMatch;
      const cities = zone.cities as string[];

      const matches = cities.some(
        (c) => normalizeString(c) === normalizeString(location.city!)
      );

      return matches
        ? {
            isMatch: true,
            specificity: SPECIFICITY_BASE.city,
            reason: `City: ${location.city}`,
          }
        : noMatch;
    }

    case "region": {
      if (!location.region) return noMatch;
      const regions = zone.regions as string[];

      const matches = regions.some(
        (r) => normalizeString(r) === normalizeString(location.region!)
      );

      return matches
        ? {
            isMatch: true,
            specificity: SPECIFICITY_BASE.region,
            reason: `Region: ${location.region}`,
          }
        : noMatch;
    }

    case "country": {
      if (!location.country) return noMatch;
      const countries = zone.countries as string[];

      const matches = countries.includes(location.country.toUpperCase());

      return matches
        ? {
            isMatch: true,
            specificity: SPECIFICITY_BASE.country,
            reason: `Country: ${getCountryName(location.country)}`,
          }
        : noMatch;
    }

    case "worldwide": {
      return {
        isMatch: true,
        specificity: SPECIFICITY_BASE.worldwide,
        reason: "Rest of World",
      };
    }

    default:
      return noMatch;
  }
}

// Helper functions
function matchPostalCode(code: string, pattern: string): boolean {
  // Handle ranges like "1001-1010"
  if (pattern.includes("-")) {
    const [start, end] = pattern.split("-").map((s) => s.trim());
    return code >= start && code <= end;
  }
  // Handle wildcards like "100*"
  if (pattern.includes("*")) {
    const prefix = pattern.replace("*", "");
    return code.startsWith(prefix);
  }
  // Exact match
  return code === pattern;
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatRadius(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(meters % 1000 === 0 ? 0 : 1)} km`;
  }
  return `${meters} m`;
}
```

### 7.2 Updated Checkout Section

```typescript
// components/store/checkout/accordion/section-fulfillment.tsx

interface SectionFulfillmentProps {
  tenantId: string;
  address: Address | null;
  subtotal: number;
  onMethodSelect: (method: FulfillmentSelection) => void;
}

interface FulfillmentSelection {
  zoneId: string;
  methodId: string;
  methodType: 'local_delivery' | 'standard' | 'express' | 'pickup';
  rate: number;
  estimatedDelivery: string;
}

export function SectionFulfillment({
  tenantId,
  address,
  subtotal,
  onMethodSelect,
}: SectionFulfillmentProps) {
  const [matchResults, setMatchResults] = useState<ZoneMatchResult[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch matching zones when address changes
  useEffect(() => {
    if (!address?.latitude || !address?.longitude) {
      setMatchResults([]);
      return;
    }

    setIsLoading(true);

    getMatchingDeliveryZones(tenantId, {
      lat: address.latitude,
      lng: address.longitude,
      country: address.country,
      region: address.state,
      city: address.city,
      postalCode: address.postalCode,
    })
      .then(setMatchResults)
      .finally(() => setIsLoading(false));
  }, [tenantId, address]);

  // Group methods by type for display
  const methodsByType = useMemo(() => {
    const groups: Record<string, Array<{
      zone: UnifiedDeliveryZone;
      method: UnifiedDeliveryMethod;
      calculatedRate: number;
    }>> = {
      local_delivery: [],
      standard: [],
      express: [],
      pickup: [],
    };

    for (const result of matchResults) {
      for (const method of result.methods) {
        const rate = calculateMethodRate(method, subtotal, /* cartWeight */ 0);
        if (rate !== null) {
          groups[method.methodType].push({
            zone: result.zone,
            method,
            calculatedRate: rate,
          });
        }
      }
    }

    // Sort each group by rate
    for (const type of Object.keys(groups)) {
      groups[type].sort((a, b) => a.calculatedRate - b.calculatedRate);
    }

    return groups;
  }, [matchResults, subtotal]);

  const cheapestOverall = useMemo(() => {
    const allMethods = Object.values(methodsByType).flat();
    return allMethods.length > 0
      ? allMethods.reduce((min, m) => m.calculatedRate < min.calculatedRate ? m : min)
      : null;
  }, [methodsByType]);

  const fastestOverall = useMemo(() => {
    const allMethods = Object.values(methodsByType).flat();
    return allMethods.length > 0
      ? allMethods.reduce((min, m) => {
          const mDays = m.method.maxDeliveryDays ?? m.method.maxDeliveryMinutes ?? Infinity;
          const minDays = min.method.maxDeliveryDays ?? min.method.maxDeliveryMinutes ?? Infinity;
          return mDays < minDays ? m : min;
        })
      : null;
  }, [methodsByType]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (matchResults.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Delivery unavailable</AlertTitle>
        <AlertDescription>
          Sorry, we don't deliver to this location. Please try a different address.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick picks */}
      {(cheapestOverall || fastestOverall) && (
        <div className="flex gap-2">
          {cheapestOverall && (
            <Button
              variant={selectedMethod === cheapestOverall.method.id ? "default" : "outline"}
              size="sm"
              onClick={() => handleSelect(cheapestOverall)}
              className="flex-1"
            >
              <Coins className="h-4 w-4 mr-2" />
              Cheapest: {formatCurrency(cheapestOverall.calculatedRate, 'AFN')}
            </Button>
          )}
          {fastestOverall && fastestOverall.method.id !== cheapestOverall?.method.id && (
            <Button
              variant={selectedMethod === fastestOverall.method.id ? "default" : "outline"}
              size="sm"
              onClick={() => handleSelect(fastestOverall)}
              className="flex-1"
            >
              <Zap className="h-4 w-4 mr-2" />
              Fastest: {fastestOverall.method.estimatedDeliveryText}
            </Button>
          )}
        </div>
      )}

      {/* Method groups */}
      {methodsByType.local_delivery.length > 0 && (
        <MethodGroup
          title="Local Delivery"
          icon={<Truck className="h-4 w-4" />}
          methods={methodsByType.local_delivery}
          selectedId={selectedMethod}
          onSelect={handleSelect}
          cheapestId={cheapestOverall?.method.id}
          fastestId={fastestOverall?.method.id}
        />
      )}

      {methodsByType.express.length > 0 && (
        <MethodGroup
          title="Express Shipping"
          icon={<Zap className="h-4 w-4" />}
          methods={methodsByType.express}
          selectedId={selectedMethod}
          onSelect={handleSelect}
          cheapestId={cheapestOverall?.method.id}
          fastestId={fastestOverall?.method.id}
        />
      )}

      {methodsByType.standard.length > 0 && (
        <MethodGroup
          title="Standard Shipping"
          icon={<Package className="h-4 w-4" />}
          methods={methodsByType.standard}
          selectedId={selectedMethod}
          onSelect={handleSelect}
          cheapestId={cheapestOverall?.method.id}
          fastestId={fastestOverall?.method.id}
        />
      )}

      {methodsByType.pickup.length > 0 && (
        <MethodGroup
          title="Store Pickup"
          icon={<Store className="h-4 w-4" />}
          methods={methodsByType.pickup}
          selectedId={selectedMethod}
          onSelect={handleSelect}
          cheapestId={cheapestOverall?.method.id}
          fastestId={fastestOverall?.method.id}
        />
      )}
    </div>
  );

  function handleSelect(item: { zone: UnifiedDeliveryZone; method: UnifiedDeliveryMethod; calculatedRate: number }) {
    setSelectedMethod(item.method.id);
    onMethodSelect({
      zoneId: item.zone.id,
      methodId: item.method.id,
      methodType: item.method.methodType,
      rate: item.calculatedRate,
      estimatedDelivery: item.method.estimatedDeliveryText || formatDeliveryTime(item.method),
    });
  }
}
```

---

## 8. Performance Optimizations

### 8.1 Caching Strategy

```typescript
// lib/delivery/cache.ts

import { unstable_cache } from "next/cache";

// Server-side zone caching (revalidates every 5 minutes)
export const getCachedDeliveryZones = unstable_cache(
  async (tenantId: string) => {
    return db.query.unifiedDeliveryZones.findMany({
      where: eq(unifiedDeliveryZones.tenantId, tenantId),
      with: { methods: true },
      orderBy: [
        desc(unifiedDeliveryZones.priority),
        asc(unifiedDeliveryZones.displayOrder),
      ],
    });
  },
  ["delivery-zones"],
  { revalidate: 300, tags: ["delivery-zones"] }
);

// Invalidate cache when zones are modified
export async function invalidateDeliveryZonesCache(tenantId: string) {
  revalidateTag("delivery-zones");
}
```

### 8.2 GeoJSON Loading

```typescript
// lib/delivery/geojson/loader.ts

// Browser-side caching with IndexedDB for GeoJSON
import { openDB } from "idb";

const DB_NAME = "kaka-malem-geo";
const STORE_NAME = "geojson";

async function getGeoJsonDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME);
    },
  });
}

export async function loadCountriesGeoJSON(): Promise<FeatureCollection> {
  // Check IndexedDB first
  const db = await getGeoJsonDB();
  const cached = await db.get(STORE_NAME, "countries");

  if (cached && cached.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000) {
    return cached.data;
  }

  // Fetch from server
  const response = await fetch("/data/geojson/countries-110m.geojson");
  const data = await response.json();

  // Cache in IndexedDB
  await db.put(STORE_NAME, { data, timestamp: Date.now() }, "countries");

  return data;
}
```

### 8.3 Nominatim Caching

```typescript
// lib/delivery/geocoding.ts

import { LRUCache } from "lru-cache";

// In-memory cache for geocoding results (server-side)
const geocodeCache = new LRUCache<string, GeocodeResult>({
  max: 500,
  ttl: 1000 * 60 * 60, // 1 hour
});

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodeResult> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;

  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
    { headers: { "User-Agent": "KakaMalem/1.0" } }
  );

  const data = await response.json();

  const result: GeocodeResult = {
    country: data.address?.country_code?.toUpperCase(),
    region: data.address?.state || data.address?.province,
    city: data.address?.city || data.address?.town || data.address?.village,
    postalCode: data.address?.postcode,
  };

  geocodeCache.set(cacheKey, result);
  return result;
}
```

### 8.4 Map Performance

```typescript
// components/dashboard/delivery/map/index.tsx

// Use Canvas renderer for better performance
<MapContainer
  center={defaultCenter}
  zoom={3}
  className="h-full w-full zone-editor-map"
  preferCanvas={true}  // Canvas is faster than SVG for many polygons
  worldCopyJump={true}
>
  {/* Lazy load country layer only when needed */}
  {showCountries && countriesGeoJSON && (
    <CountryLayer
      data={countriesGeoJSON}
      selectedCountries={selectedCountries}
      onCountryToggle={handleCountryToggle}
      zoneColor={editingZone?.color || '#3b82f6'}
    />
  )}

  {/* Local zones always visible */}
  <LocalZonesLayer zones={localZones} />
</MapContainer>
```

---

## 9. Migration Strategy

### 9.1 Feature Flag Approach

```typescript
// lib/feature-flags.ts

export async function useUnifiedDelivery(tenantId: string): Promise<boolean> {
  // Check if tenant has been migrated
  const hasUnifiedZones = await db.query.unifiedDeliveryZones.findFirst({
    where: eq(unifiedDeliveryZones.tenantId, tenantId),
    columns: { id: true },
  });

  return !!hasUnifiedZones;
}

// Usage in checkout
export async function getDeliveryOptions(tenantId: string, location: Location) {
  const useUnified = await useUnifiedDelivery(tenantId);

  if (useUnified) {
    return getUnifiedDeliveryOptions(tenantId, location);
  }

  // Legacy path
  return getLegacyDeliveryOptions(tenantId, location);
}
```

### 9.2 Data Migration Script

```typescript
// scripts/migrate-to-unified-delivery.ts

import { db } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function migrateTenantsToUnifiedDelivery(
  tenantIds?: string[], // If not provided, migrate all
  dryRun = false
) {
  const tenants = tenantIds
    ? await db.query.tenants.findMany({ where: inArray(tenants.id, tenantIds) })
    : await db.query.tenants.findMany();

  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [] as { tenantId: string; error: string }[],
  };

  for (const tenant of tenants) {
    try {
      // Check if already migrated
      const existing = await db.query.unifiedDeliveryZones.findFirst({
        where: eq(unifiedDeliveryZones.tenantId, tenant.id),
      });

      if (existing) {
        results.skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`[DRY RUN] Would migrate tenant: ${tenant.id}`);
        results.success++;
        continue;
      }

      await db.transaction(async (tx) => {
        // 1. Migrate delivery_zones (GPS-based)
        const deliveryZones = await tx.query.deliveryZones.findMany({
          where: eq(deliveryZones.tenantId, tenant.id),
        });

        for (const zone of deliveryZones) {
          const newZone = await tx
            .insert(unifiedDeliveryZones)
            .values({
              tenantId: tenant.id,
              name: zone.name,
              zoneType: zone.zoneType as "radius" | "polygon",
              centerLat: zone.centerLat,
              centerLng: zone.centerLng,
              radiusMeters: zone.radiusMeters,
              polygonGeojson: zone.polygonCoordinates,
              color: zone.color,
              displayOrder: zone.displayOrder,
              isActive: zone.isActive,
            })
            .returning();

          // Create delivery method from zone settings
          await tx.insert(unifiedDeliveryMethods).values({
            zoneId: newZone[0].id,
            tenantId: tenant.id,
            name: "Local Delivery",
            methodType: "local_delivery",
            rateType: "flat",
            baseRate: zone.deliveryFee?.toString() || "0",
            minOrderAmount: zone.minOrderAmount?.toString(),
            freeShippingThreshold: zone.freeShippingThreshold?.toString(),
            estimatedDeliveryText: zone.estimatedDeliveryTime,
            isActive: true,
          });
        }

        // 2. Migrate shipping_zones (country-based)
        const shippingZones = await tx.query.shippingZones.findMany({
          where: eq(shippingZones.tenantId, tenant.id),
        });

        for (const zone of shippingZones) {
          // Determine zone type based on what's filled
          let zoneType: "country" | "region" | "city" | "postal" = "country";
          if ((zone.cities as string[])?.length > 0) zoneType = "city";
          else if ((zone.states as string[])?.length > 0) zoneType = "region";
          else if ((zone.postalCodes as string[])?.length > 0)
            zoneType = "postal";

          const newZone = await tx
            .insert(unifiedDeliveryZones)
            .values({
              tenantId: tenant.id,
              name: zone.name,
              description: zone.description,
              zoneType,
              countries: zone.countries,
              regions: zone.states,
              cities: zone.cities,
              postalCodes: zone.postalCodes,
              priority: zone.priority,
              isActive: zone.isActive,
            })
            .returning();

          // Migrate shipping methods
          const methods = await tx.query.shippingMethods.findMany({
            where: eq(shippingMethods.zoneId, zone.id),
          });

          for (const method of methods) {
            await tx.insert(unifiedDeliveryMethods).values({
              zoneId: newZone[0].id,
              tenantId: tenant.id,
              name: method.name,
              description: method.description,
              methodType: "standard",
              rateType: method.rateType as any,
              baseRate: method.baseRate?.toString(),
              perItemRate: method.perItemRate?.toString(),
              perKgRate: method.perKgRate?.toString(),
              freeShippingThreshold: method.freeShippingThreshold?.toString(),
              minDeliveryDays: method.minDeliveryDays,
              maxDeliveryDays: method.maxDeliveryDays,
              minWeightKg: method.minWeight?.toString(),
              maxWeightKg: method.maxWeight?.toString(),
              handlingFee: method.handlingFee?.toString(),
              includesTracking: method.includesTracking,
              displayOrder: method.displayOrder,
              isActive: method.isActive,
            });
          }
        }
      });

      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        tenantId: tenant.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}
```

### 9.3 Timeline

| Week | Action                                                | Rollback Plan           |
| ---- | ----------------------------------------------------- | ----------------------- |
| 1    | Deploy unified tables + new UI (hidden)               | N/A                     |
| 2    | Enable for 5 pilot stores                             | Feature flag per tenant |
| 3    | Gather feedback, fix issues                           | Revert flag             |
| 4    | Migrate all stores, show deprecation notice on old UI | Dual-system support     |
| 6    | Hide old UI, redirect to new                          | Keep old tables         |
| 10   | Archive old tables                                    | Full backup available   |

---

## 10. Edge Cases & Error Handling

### 10.1 Edge Cases

| Scenario                        | Handling                                                                   |
| ------------------------------- | -------------------------------------------------------------------------- |
| **No zones configured**         | Show "Contact store" message at checkout                                   |
| **Location outside all zones**  | Check for "worldwide" catch-all zone; if none, show "Delivery unavailable" |
| **Multiple zones match**        | Return ALL matches; let customer choose (sorted by specificity)            |
| **Zone with no active methods** | Skip zone in matching                                                      |
| **Free shipping threshold met** | Show "Free shipping!" badge, rate = 0                                      |
| **Min order not met**           | Show method disabled with "Min order: X AFN" message                       |
| **Weight exceeds limit**        | Hide method or show "Too heavy for this option"                            |
| **GeoJSON fails to load**       | Fall back to dropdown country selector                                     |
| **Nominatim rate limited**      | Cache aggressively, show cached results, retry with backoff                |

### 10.2 Error Boundaries

```typescript
// components/dashboard/delivery/map/error-boundary.tsx

export function MapErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center justify-center h-[400px] bg-muted rounded-lg">
          <div className="text-center">
            <MapOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Map failed to load</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
```

### 10.3 Validation Schemas

```typescript
// lib/validations/unified-delivery.ts

import { z } from "zod";

export const unifiedZoneSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(255),
    description: z.string().optional(),
    zoneType: z.enum([
      "polygon",
      "radius",
      "postal",
      "city",
      "region",
      "country",
      "worldwide",
    ]),

    // Conditional fields based on zoneType
    countries: z.array(z.string().length(2)).optional(),
    regions: z.array(z.string()).optional(),
    cities: z.array(z.string()).optional(),
    postalCodes: z.array(z.string()).optional(),
    centerLat: z.number().min(-90).max(90).optional(),
    centerLng: z.number().min(-180).max(180).optional(),
    radiusMeters: z.number().positive().max(100000).optional(),
    polygonGeojson: z.any().optional(), // GeoJSON validation is complex

    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .default("#3b82f6"),
    priority: z.number().int().default(0),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      // Validate required fields based on zone type
      switch (data.zoneType) {
        case "radius":
          return (
            data.centerLat != null &&
            data.centerLng != null &&
            data.radiusMeters != null
          );
        case "polygon":
          return data.polygonGeojson != null;
        case "country":
          return data.countries && data.countries.length > 0;
        case "region":
          return data.regions && data.regions.length > 0;
        case "city":
          return data.cities && data.cities.length > 0;
        default:
          return true;
      }
    },
    { message: "Missing required fields for zone type" }
  );

export const deliveryMethodSchema = z
  .object({
    name: z.string().min(1).max(255),
    methodType: z.enum([
      "local_delivery",
      "standard",
      "express",
      "pickup",
      "custom",
    ]),
    rateType: z.enum([
      "flat",
      "per_item",
      "weight_based",
      "weight_tiered",
      "price_based",
      "free",
    ]),
    baseRate: z.number().nonnegative().default(0),
    perItemRate: z.number().nonnegative().optional(),
    perKgRate: z.number().nonnegative().optional(),
    freeShippingThreshold: z.number().positive().optional(),
    minOrderAmount: z.number().positive().optional(),
    minDeliveryDays: z.number().int().nonnegative().optional(),
    maxDeliveryDays: z.number().int().positive().optional(),
    estimatedDeliveryText: z.string().max(100).optional(),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.minDeliveryDays != null && data.maxDeliveryDays != null) {
        return data.minDeliveryDays <= data.maxDeliveryDays;
      }
      return true;
    },
    { message: "Min delivery days cannot exceed max delivery days" }
  );
```

---

## 11. Testing Strategy

### 11.1 Unit Tests

```typescript
// __tests__/lib/delivery/zone-matcher.test.ts

import { matchLocationToZones } from "@/lib/delivery/zone-matcher";

describe("Zone Matcher", () => {
  const mockZones = [
    createMockZone({
      id: "1",
      zoneType: "radius",
      radiusMeters: 5000,
      centerLat: 34.5553,
      centerLng: 69.2075,
    }),
    createMockZone({ id: "2", zoneType: "country", countries: ["AF"] }),
    createMockZone({ id: "3", zoneType: "worldwide" }),
  ];

  test("matches radius zone for location within radius", () => {
    const location = { lat: 34.556, lng: 69.208 }; // ~100m from center
    const results = matchLocationToZones(location, mockZones);

    expect(results[0].zone.id).toBe("1"); // Radius zone is most specific
    expect(results).toHaveLength(3); // All zones match (radius, country, worldwide)
  });

  test("falls back to country zone when outside radius", () => {
    const location = { lat: 35.0, lng: 70.0, country: "AF" }; // Far from radius center
    const results = matchLocationToZones(location, mockZones);

    expect(results[0].zone.id).toBe("2"); // Country zone is most specific
    expect(results).toHaveLength(2); // Country + worldwide
  });

  test("falls back to worldwide when no other match", () => {
    const location = { lat: 40.0, lng: -74.0, country: "US" }; // New York
    const results = matchLocationToZones(location, mockZones);

    expect(results[0].zone.id).toBe("3"); // Only worldwide matches
    expect(results).toHaveLength(1);
  });

  test("smaller radius scores higher than larger radius", () => {
    const zones = [
      createMockZone({
        id: "1",
        zoneType: "radius",
        radiusMeters: 10000,
        centerLat: 34.5553,
        centerLng: 69.2075,
      }),
      createMockZone({
        id: "2",
        zoneType: "radius",
        radiusMeters: 2000,
        centerLat: 34.5553,
        centerLng: 69.2075,
      }),
    ];

    const location = { lat: 34.556, lng: 69.208 };
    const results = matchLocationToZones(location, zones);

    expect(results[0].zone.id).toBe("2"); // Smaller radius wins
  });
});
```

### 11.2 Integration Tests

```typescript
// __tests__/integration/checkout-delivery.test.ts

import { test, expect } from "@playwright/test";

test.describe("Checkout Delivery Selection", () => {
  test.beforeEach(async ({ page }) => {
    // Set up test store with zones
    await setupTestStore(page);
    await page.goto("/store/test-store/checkout");
  });

  test("shows local delivery options when in delivery zone", async ({
    page,
  }) => {
    // Enter address within delivery zone
    await page.fill('[data-testid="address-search"]', "Kabul City Center");
    await page.click('[data-testid="search-result"]:first-child');

    // Wait for zone matching
    await page.waitForSelector('[data-testid="delivery-options"]');

    // Should show local delivery
    await expect(page.locator("text=Local Delivery")).toBeVisible();
  });

  test("shows only shipping when outside local delivery zone", async ({
    page,
  }) => {
    // Enter address in different city
    await page.fill('[data-testid="address-search"]', "Herat City");
    await page.click('[data-testid="search-result"]:first-child');

    await page.waitForSelector('[data-testid="delivery-options"]');

    // Should NOT show local delivery
    await expect(page.locator("text=Local Delivery")).not.toBeVisible();
    // Should show standard shipping
    await expect(page.locator("text=Standard Shipping")).toBeVisible();
  });

  test("highlights cheapest and fastest options", async ({ page }) => {
    await selectValidAddress(page);

    const cheapestBadge = page.locator('[data-testid="cheapest-badge"]');
    const fastestBadge = page.locator('[data-testid="fastest-badge"]');

    await expect(cheapestBadge).toBeVisible();
    await expect(fastestBadge).toBeVisible();
  });
});
```

### 11.3 E2E Test Coverage

| Scenario                          | Priority | Status |
| --------------------------------- | -------- | ------ |
| Create country zone via map click | High     | TODO   |
| Create radius zone with drag      | High     | TODO   |
| Edit existing zone                | High     | TODO   |
| Delete zone                       | Medium   | TODO   |
| Zone matching at checkout         | High     | TODO   |
| Free shipping threshold           | High     | TODO   |
| Min order enforcement             | Medium   | TODO   |
| GeoJSON loading failure           | Low      | TODO   |

---

## 12. Implementation Phases

### Phase 1: Map Components (Week 1-2)

**Tasks:**

1. [x] Download and optimize GeoJSON data
2. [ ] Create `CountryLayer` component with hover effects
3. [ ] Create `LocalZonesLayer` component
4. [ ] Implement `MapControls` (search, bulk select, layers)
5. [ ] Add country search/zoom functionality
6. [ ] Performance test with 195 countries

**Deliverables:**

- `components/dashboard/delivery/map/*`
- `public/data/geojson/*`
- Storybook stories for map components

### Phase 2: Zone Editor (Week 2-3)

**Tasks:**

1. [ ] Create database migration
2. [ ] Run migration, update Drizzle schema
3. [ ] Build `ZoneEditor` dialog with steps
4. [ ] Implement `ZoneTypeSelector`
5. [ ] Build `CountrySelector` with map integration
6. [ ] Build `LocalZoneEditor` (radius/polygon)
7. [ ] Build `MethodEditor` for delivery methods
8. [ ] Create Zod validation schemas
9. [ ] Implement server actions

**Deliverables:**

- `components/dashboard/delivery/zone-editor/*`
- `lib/actions/unified-delivery.ts`
- `lib/validations/unified-delivery.ts`

### Phase 3: Checkout Integration (Week 3-4)

**Tasks:**

1. [ ] Implement `matchLocationToZones` algorithm
2. [ ] Add geocoding cache layer
3. [ ] Build `SectionFulfillment` component
4. [ ] Add cheapest/fastest highlighting
5. [ ] Update order creation to use unified zones
6. [ ] Test backward compatibility

**Deliverables:**

- `lib/delivery/zone-matcher.ts`
- `components/store/checkout/accordion/section-fulfillment.tsx`
- Updated `lib/actions/checkout.ts`

### Phase 4: Migration & Polish (Week 4-5)

**Tasks:**

1. [ ] Create migration script
2. [ ] Test migration on staging
3. [ ] Migrate pilot stores
4. [ ] Gather feedback, fix issues
5. [ ] Full rollout
6. [ ] Add deprecation warnings
7. [ ] Update CLAUDE.md

**Deliverables:**

- `scripts/migrate-to-unified-delivery.ts`
- Updated documentation

### Phase 5: Advanced Features (Future)

- [ ] Continent bulk selection
- [ ] Zone templates ("Afghanistan Only", "Central Asia")
- [ ] Import/export zones from CSV
- [ ] Zone performance analytics
- [ ] A/B test shipping offers
- [ ] Cart weight tracking for weight-based rates

---

## Summary

This refined implementation plan addresses:

1. **All identified issues** from the codebase analysis
2. **Performance optimizations** (caching, deduplication)
3. **Clear component specifications** with code examples
4. **Comprehensive edge case handling**
5. **Testing strategy** with unit and integration tests
6. **Detailed migration path** with rollback plan

The unified system will provide:

- **Single UI** for all delivery configuration
- **Interactive map** with country hover/click selection
- **Hierarchical zone matching** (most specific wins)
- **Clear checkout UX** with cheapest/fastest options highlighted
- **Backward compatibility** during migration

**Next Steps:**

1. Review and approve this plan
2. Begin Phase 1 (map components)
3. Set up GeoJSON data files
4. Create Storybook for component development
