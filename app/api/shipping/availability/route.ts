import { NextRequest, NextResponse } from "next/server";
import { getShippingZones } from "@/lib/db/queries/shipping";
import { getActiveDeliveryZones } from "@/lib/actions/delivery-zones";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { checkDeliveryZone } from "@/lib/geo/delivery-zone-check";

/**
 * Check shipping/delivery availability for a location
 *
 * This endpoint allows early availability checking (like Amazon's "Delivers to [location]")
 * before the user reaches checkout.
 *
 * Query params:
 * - slug: Store slug (required)
 * - lat: Latitude (required)
 * - lng: Longitude (required)
 * - city: City name (optional, for shipping zone matching)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const city = searchParams.get("city");

    if (!slug) {
      return NextResponse.json(
        { error: "Store slug is required" },
        { status: 400 }
      );
    }

    if (!lat || !lng) {
      return NextResponse.json(
        { error: "Latitude and longitude are required" },
        { status: 400 }
      );
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: "Invalid coordinates" },
        { status: 400 }
      );
    }

    // Get store settings
    const store = await getTenantBySlug(slug);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const enableDeliveryZones = store.enableDeliveryZones;
    const enableShipping = store.enableShipping ?? true;

    // Check availability
    let canDeliver = false;
    let canShip = false;
    let deliveryZoneName: string | null = null;
    let shippingZoneName: string | null = null;
    let message: string | null = null;

    // 1. Check local delivery zones (GPS-based)
    if (enableDeliveryZones) {
      const deliveryZones = await getActiveDeliveryZones(store.id);
      if (deliveryZones.length > 0) {
        const zoneResult = checkDeliveryZone(
          latitude,
          longitude,
          deliveryZones
        );
        if (zoneResult.isWithinZone && zoneResult.matchingZone) {
          canDeliver = true;
          deliveryZoneName = zoneResult.matchingZone.name;
        }
      }
    }

    // 2. Check shipping zones (city/province-based)
    if (enableShipping) {
      const shippingZones = await getShippingZones(store.id);

      if (shippingZones.length === 0) {
        // No zones configured = ship everywhere (catch-all)
        canShip = true;
        shippingZoneName = "Worldwide";
      } else {
        // Check if any zone matches
        // For early check, we do a simplified match:
        // - If there's a catch-all zone (no geographic restrictions), shipping is available
        // - If city is provided, check city/province matching

        for (const zone of shippingZones) {
          const hasCities = zone.cities && zone.cities.length > 0;
          const hasStates = zone.states && zone.states.length > 0;
          const hasCountries = zone.countries && zone.countries.length > 0;
          const hasPostalCodes =
            zone.postalCodes && zone.postalCodes.length > 0;

          // Catch-all zone
          if (!hasCities && !hasStates && !hasCountries && !hasPostalCodes) {
            canShip = true;
            shippingZoneName = zone.name;
            break;
          }

          // If city provided, check for match
          if (city && hasCities) {
            const cityLower = city.toLowerCase();
            if (zone.cities!.some((c) => c.toLowerCase() === cityLower)) {
              canShip = true;
              shippingZoneName = zone.name;
              break;
            }
          }

          // Province-level zones are harder to check without reverse geocoding
          // For early check, we'll be optimistic if there are province-level zones
          if (hasStates && !hasCities) {
            // Could do reverse geocoding here, but for early check we'll skip
            // The full check happens at checkout
            canShip = true;
            shippingZoneName = zone.name;
            break;
          }
        }
      }
    }

    // Determine overall availability and message
    const isAvailable = canDeliver || canShip;

    if (isAvailable) {
      if (canDeliver && canShip) {
        message = `Delivers to your location`;
      } else if (canDeliver) {
        message = `Local delivery available (${deliveryZoneName})`;
      } else {
        message = `Shipping available`;
      }
    } else {
      if (!enableDeliveryZones && !enableShipping) {
        message = "This store doesn't offer delivery";
      } else if (enableDeliveryZones && !enableShipping) {
        message = "Delivery not available to your location";
      } else {
        message = "Shipping not available to your location";
      }
    }

    return NextResponse.json({
      available: isAvailable,
      canDeliver,
      canShip,
      deliveryZoneName,
      shippingZoneName,
      message,
      settings: {
        enableDeliveryZones,
        enableShipping,
      },
    });
  } catch (error) {
    console.error("Shipping availability check error:", error);
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 }
    );
  }
}
