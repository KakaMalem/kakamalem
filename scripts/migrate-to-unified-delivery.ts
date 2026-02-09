/**
 * Migration Script: Legacy Delivery/Shipping Zones → Unified Delivery System
 *
 * This script migrates data from the legacy delivery and shipping systems
 * to the new unified delivery system.
 *
 * IMPORTANT: Run this script in a transaction and test on staging first!
 *
 * Usage:
 *   npx tsx scripts/migrate-to-unified-delivery.ts
 *
 * Options:
 *   --dry-run    Preview changes without applying them
 *   --tenant-id  Migrate only a specific tenant
 *
 * What gets migrated:
 *   1. delivery_zones → unified_delivery_zones (type: radius/polygon)
 *      - Each zone's delivery fee becomes a delivery method
 *   2. shipping_zones → unified_delivery_zones (type: country/region/city/postal)
 *   3. shipping_methods → unified_delivery_methods (attached to migrated zones)
 */

import type { Polygon } from "geojson";

// Load environment variables FIRST
import "dotenv/config";

// Verify DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL not found in environment variables");
  console.error("   Make sure .env or .env.local contains DATABASE_URL");
  process.exit(1);
}

// Run the migration
(async () => {
  // Dynamic imports to ensure env vars are loaded first
  const { db } = await import("@/lib/db");
  const {
    deliveryZones,
    shippingZones,
    unifiedDeliveryZones,
    unifiedDeliveryMethods,
  } = await import("@/lib/db/schema");
  const { eq, sql } = await import("drizzle-orm");

  // Parse command line arguments
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const tenantIdArg = args.find((a) => a.startsWith("--tenant-id="));
  const specificTenantId = tenantIdArg?.split("=")[1];

  // Zone specificity scores (from unified system)
  const ZONE_SPECIFICITY = {
    polygon: 600,
    radius: 500,
    postal: 400,
    city: 300,
    region: 200,
    country: 100,
    worldwide: 10,
  };

  // Color palette for migrated zones
  const ZONE_COLORS = [
    "#3b82f6", // blue
    "#ef4444", // red
    "#22c55e", // green
    "#f59e0b", // amber
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#f97316", // orange
  ];

  let colorIndex = 0;
  function getNextColor(): string {
    const color = ZONE_COLORS[colorIndex % ZONE_COLORS.length];
    colorIndex++;
    return color;
  }

  // Map legacy rate types to unified rate types
  type LegacyRateType = "flat" | "per_item" | "weight_based" | "price_based";
  type UnifiedRateType =
    | "flat"
    | "free"
    | "per_item"
    | "weight_based"
    | "weight_tiered"
    | "price_based";

  function mapRateType(legacyType: LegacyRateType): UnifiedRateType {
    const mapping: Record<LegacyRateType, UnifiedRateType> = {
      flat: "flat",
      per_item: "per_item",
      weight_based: "weight_based",
      price_based: "price_based",
    };
    return mapping[legacyType] || "flat";
  }

  // Track migration stats
  const stats = {
    deliveryZonesMigrated: 0,
    shippingZonesMigrated: 0,
    shippingMethodsMigrated: 0,
    errors: [] as string[],
  };

  async function migrateDeliveryZones() {
    console.log("\n📍 Migrating GPS-based delivery zones...");

    const zones = await db.query.deliveryZones.findMany({
      where: specificTenantId
        ? eq(deliveryZones.tenantId, specificTenantId)
        : undefined,
    });

    console.log(`   Found ${zones.length} delivery zones to migrate`);

    for (const zone of zones) {
      try {
        const existing = await db.query.unifiedDeliveryZones.findFirst({
          where: sql`${unifiedDeliveryZones.tenantId} = ${zone.tenantId}
            AND ${unifiedDeliveryZones.name} = ${zone.name}
            AND ${unifiedDeliveryZones.zoneType} IN ('radius', 'polygon')`,
        });

        if (existing) {
          console.log(`   ⏭️  Skipping "${zone.name}" - already migrated`);
          continue;
        }

        const isPolygon =
          zone.zoneType === "polygon" && zone.polygonCoordinates;
        const zoneType = isPolygon ? "polygon" : "radius";
        const specificityScore = isPolygon
          ? ZONE_SPECIFICITY.polygon
          : ZONE_SPECIFICITY.radius;

        let polygonGeojson: Polygon | null = null;
        if (isPolygon && zone.polygonCoordinates) {
          polygonGeojson = {
            type: "Polygon",
            coordinates: [zone.polygonCoordinates as [number, number][]],
          };
        }

        if (isDryRun) {
          console.log(`   🔍 Would migrate "${zone.name}" as ${zoneType} zone`);
          stats.deliveryZonesMigrated++;
          continue;
        }

        const [newZone] = await db
          .insert(unifiedDeliveryZones)
          .values({
            tenantId: zone.tenantId,
            name: zone.name,
            zoneType,
            specificityScore,
            centerLat: zone.centerLat,
            centerLng: zone.centerLng,
            radiusMeters: zone.radiusMeters,
            polygonGeojson,
            color: getNextColor(),
            isActive: zone.isActive ?? true,
            displayOrder: zone.displayOrder ?? 0,
          })
          .returning();

        const deliveryFee = zone.deliveryFee ? parseFloat(zone.deliveryFee) : 0;
        const freeThreshold = zone.freeShippingThreshold
          ? parseFloat(zone.freeShippingThreshold)
          : null;

        await db.insert(unifiedDeliveryMethods).values({
          tenantId: zone.tenantId,
          zoneId: newZone.id,
          name: "Local Delivery",
          description:
            zone.estimatedDeliveryTime || "Local delivery to your area",
          methodType: "local_delivery",
          rateType: deliveryFee > 0 ? "flat" : "free",
          baseRate: deliveryFee.toFixed(2),
          freeShippingThreshold: freeThreshold?.toFixed(2) || null,
          minOrderAmount: zone.minOrderAmount?.toString() || null,
          isActive: zone.isActive ?? true,
          displayOrder: 0,
          handlingFee: "0",
        });

        stats.deliveryZonesMigrated++;
        console.log(`   ✅ Migrated "${zone.name}" (${zoneType})`);
      } catch (error) {
        const msg = `Failed to migrate delivery zone "${zone.name}": ${error}`;
        stats.errors.push(msg);
        console.error(`   ❌ ${msg}`);
      }
    }
  }

  async function migrateShippingZones() {
    console.log("\n📦 Migrating text-based shipping zones...");

    const zones = await db.query.shippingZones.findMany({
      where: specificTenantId
        ? eq(shippingZones.tenantId, specificTenantId)
        : undefined,
      with: {
        methods: true,
      },
    });

    console.log(`   Found ${zones.length} shipping zones to migrate`);

    for (const zone of zones) {
      try {
        let zoneType: "country" | "region" | "city" | "postal" | "worldwide" =
          "worldwide";
        let specificityScore = ZONE_SPECIFICITY.worldwide;

        const hasPostalCodes = zone.postalCodes && zone.postalCodes.length > 0;
        const hasCities = zone.cities && zone.cities.length > 0;
        const hasStates = zone.states && zone.states.length > 0;
        const hasCountries = zone.countries && zone.countries.length > 0;

        if (hasPostalCodes) {
          zoneType = "postal";
          specificityScore = ZONE_SPECIFICITY.postal;
        } else if (hasCities) {
          zoneType = "city";
          specificityScore = ZONE_SPECIFICITY.city;
        } else if (hasStates) {
          zoneType = "region";
          specificityScore = ZONE_SPECIFICITY.region;
        } else if (hasCountries) {
          zoneType = "country";
          specificityScore = ZONE_SPECIFICITY.country;
        }

        const existing = await db.query.unifiedDeliveryZones.findFirst({
          where: sql`${unifiedDeliveryZones.tenantId} = ${zone.tenantId}
            AND ${unifiedDeliveryZones.name} = ${zone.name}
            AND ${unifiedDeliveryZones.zoneType} = ${zoneType}`,
        });

        if (existing) {
          console.log(`   ⏭️  Skipping "${zone.name}" - already migrated`);
          continue;
        }

        if (isDryRun) {
          console.log(
            `   🔍 Would migrate "${zone.name}" as ${zoneType} zone with ${zone.methods?.length || 0} methods`
          );
          stats.shippingZonesMigrated++;
          stats.shippingMethodsMigrated += zone.methods?.length || 0;
          continue;
        }

        const [newZone] = await db
          .insert(unifiedDeliveryZones)
          .values({
            tenantId: zone.tenantId,
            name: zone.name,
            zoneType,
            specificityScore,
            countries: hasCountries ? zone.countries : null,
            regions: hasStates ? zone.states : null,
            cities: hasCities ? zone.cities : null,
            postalPatterns: hasPostalCodes ? zone.postalCodes : null,
            color: getNextColor(),
            isActive: zone.isActive ?? true,
            displayOrder: zone.priority ?? 0,
          })
          .returning();

        if (zone.methods && zone.methods.length > 0) {
          for (const method of zone.methods) {
            try {
              await db.insert(unifiedDeliveryMethods).values({
                tenantId: zone.tenantId,
                zoneId: newZone.id,
                name: method.name,
                description: method.description,
                methodType: "standard",
                rateType: mapRateType(method.rateType as LegacyRateType),
                baseRate: method.baseRate,
                perItemRate: method.perItemRate,
                perKgRate: method.perKgRate,
                freeShippingThreshold: method.freeShippingThreshold,
                minDeliveryDays: method.minDeliveryDays,
                maxDeliveryDays: method.maxDeliveryDays,
                minWeight: method.minWeight?.toString() || null,
                maxWeight: method.maxWeight?.toString() || null,
                isActive: method.isActive ?? true,
                displayOrder: 0,
                handlingFee: "0",
              });
              stats.shippingMethodsMigrated++;
            } catch (error) {
              const msg = `Failed to migrate method "${method.name}" for zone "${zone.name}": ${error}`;
              stats.errors.push(msg);
              console.error(`      ❌ ${msg}`);
            }
          }
        } else {
          await db.insert(unifiedDeliveryMethods).values({
            tenantId: zone.tenantId,
            zoneId: newZone.id,
            name: "Standard Shipping",
            description: "Standard delivery",
            methodType: "standard",
            rateType: "flat",
            baseRate: "0",
            isActive: zone.isActive ?? true,
            displayOrder: 0,
            handlingFee: "0",
          });
          stats.shippingMethodsMigrated++;
        }

        stats.shippingZonesMigrated++;
        console.log(
          `   ✅ Migrated "${zone.name}" (${zoneType}) with ${zone.methods?.length || 1} method(s)`
        );
      } catch (error) {
        const msg = `Failed to migrate shipping zone "${zone.name}": ${error}`;
        stats.errors.push(msg);
        console.error(`   ❌ ${msg}`);
      }
    }
  }

  // Main execution
  console.log("🚀 Starting Unified Delivery System Migration");
  console.log("================================================");

  if (isDryRun) {
    console.log("⚠️  DRY RUN MODE - No changes will be made\n");
  }

  if (specificTenantId) {
    console.log(`📌 Migrating only tenant: ${specificTenantId}\n`);
  }

  try {
    await migrateDeliveryZones();
    await migrateShippingZones();

    console.log("\n================================================");
    console.log("📊 Migration Summary");
    console.log("================================================");
    console.log(`   Delivery zones migrated: ${stats.deliveryZonesMigrated}`);
    console.log(`   Shipping zones migrated: ${stats.shippingZonesMigrated}`);
    console.log(
      `   Shipping methods migrated: ${stats.shippingMethodsMigrated}`
    );

    if (stats.errors.length > 0) {
      console.log(`\n   ⚠️  Errors: ${stats.errors.length}`);
      stats.errors.forEach((e) => console.log(`      - ${e}`));
    }

    if (isDryRun) {
      console.log(
        "\n⚠️  This was a dry run. Run without --dry-run to apply changes."
      );
    } else {
      console.log("\n✅ Migration completed successfully!");
      console.log("\n📝 Next steps:");
      console.log("   1. Review migrated zones in the dashboard");
      console.log("   2. Test checkout with the unified system");
      console.log(
        "   3. Once verified, you can optionally disable the legacy systems"
      );
    }

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
})();
