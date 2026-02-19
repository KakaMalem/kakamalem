"use server";

import { revalidatePath } from "next/cache";
import { eq, and, sql, inArray } from "drizzle-orm";
import { withTransaction, type Transaction } from "@/lib/db";
import {
  orders,
  orderItems,
  products,
  productVariants,
  inventoryMovements,
  storeCustomers,
  cartItems,
  shippingMethods,
  tenants,
} from "@/lib/db/schema";
import type { Address, CustomerSnapshot } from "@/lib/db/schema";
import { getUser } from "@/lib/auth/server";
import {
  getOrCreateCartSessionInAction,
  clearCartSession,
} from "@/lib/cart/session";
import { validateCartForCheckout } from "@/lib/db/queries/carts";
import {
  getAvailableShippingMethods,
  calculateShippingRate,
  type CartItemForShipping,
} from "@/lib/db/queries/shipping";
import { db } from "@/lib/db";
import {
  checkoutSubmitSchema,
  type CheckoutSubmitInput,
  type PaymentGateway,
} from "@/lib/validations/checkout";
import type { CartPriceTier } from "@/lib/db/queries/carts";
import type { PaymentMethod } from "@/lib/db/schema";
import { getActiveDeliveryZones } from "@/lib/actions/delivery-zones";
import { checkDeliveryZone } from "@/lib/geo/delivery-zone-check";
import { sendOrderNotificationToTenant } from "@/lib/notifications/triggers";
import {
  validateCouponAction,
  recordCouponUsage,
  createOrderDiscountRecord,
} from "@/lib/actions/coupons";
import type { CartItemForCoupon } from "@/lib/validations/coupons";
import {
  isUnifiedDeliveryEnabled,
  getDeliveryOptions,
} from "@/lib/actions/unified-delivery";
import { getProductsCampaignDiscounts } from "@/lib/db/queries/campaigns";
import { applyCampaignDiscount } from "@/lib/utils/pricing-display";

// =============================================================================
// DELIVERY SETTINGS HELPER
// =============================================================================

/**
 * Fulfillment settings for a tenant
 */
type TenantFulfillmentSettings = {
  enableDeliveryZones: boolean;
  enableShipping: boolean;
};

/**
 * Get the tenant's fulfillment settings (delivery zones + shipping)
 * Uses direct SQL query to bypass any potential caching
 */
async function getTenantDeliverySettings(
  tenantId: string
): Promise<TenantFulfillmentSettings> {
  // Use direct query to ensure fresh data (no Next.js data cache)
  const result = await db
    .select({
      enableDeliveryZones: tenants.enableDeliveryZones,
      enableShipping: tenants.enableShipping,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return {
    enableDeliveryZones: result[0]?.enableDeliveryZones ?? false,
    enableShipping: result[0]?.enableShipping ?? true,
  };
}

// =============================================================================
// PAYMENT GATEWAY TO METHOD MAPPING
// =============================================================================

/**
 * Map payment gateway (checkout selection) to payment method enum (for orders table)
 */
function mapGatewayToPaymentMethod(gateway: PaymentGateway): PaymentMethod {
  const mapping: Record<PaymentGateway, PaymentMethod> = {
    hesabpay: "card", // HesabPay is card payment
    stripe: "card", // Stripe is card payment
    cod: "cash", // Cash on Delivery
    bank_transfer: "bank_transfer",
    mobile_money: "mobile_money",
    crypto_usdt: "card", // Crypto USDT - treated as digital payment like card
  };
  return mapping[gateway] || "cash";
}

// =============================================================================
// TIER PRICING HELPER
// =============================================================================

/**
 * Get the applicable tier price for a given quantity
 */
function getApplicableTierPrice(
  basePrice: number,
  quantity: number,
  priceTiers: CartPriceTier[]
): number {
  if (!priceTiers || priceTiers.length === 0) return basePrice;

  const sortedTiers = [...priceTiers].sort(
    (a, b) => b.minQuantity - a.minQuantity
  );

  for (const tier of sortedTiers) {
    if (quantity >= tier.minQuantity) {
      if (tier.maxQuantity === null || quantity <= tier.maxQuantity) {
        return parseFloat(tier.price);
      }
    }
  }

  return basePrice;
}

// =============================================================================
// TYPES
// =============================================================================

export type CheckoutResult = {
  success: boolean;
  error?: {
    message: string;
    code?: string;
    cartErrors?: Array<{ itemId: string; productName: string; error: string }>;
  };
  order?: {
    id: string;
    orderNumber: string;
  };
};

/**
 * Fulfillment method type - distinguishes between local delivery and shipping
 */
export type FulfillmentMethodType = "local_delivery" | "shipping";

/**
 * Single fulfillment option (either local delivery zone or shipping method)
 */
export type FulfillmentMethod = {
  id: string;
  name: string;
  description: string | null;
  price: number; // Total price
  basePrice?: number; // Base rate (without any discounts)
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
  type: FulfillmentMethodType; // Distinguishes local delivery from shipping
  zoneId?: string; // For local delivery, the GPS zone ID
};

export type ShippingCalculationResult = {
  success: boolean;
  error?: { message: string };
  data?: {
    zone: {
      id: string;
      name: string;
    } | null;
    deliveryZoneFee?: number; // Base delivery fee from GPS-based delivery zone
    deliveryZonesEnabled: boolean; // Whether GPS delivery zones are enabled for this store
    shippingEnabled: boolean; // Whether shipping is enabled for this store
    isWithinDeliveryZone: boolean; // Whether customer is within a GPS delivery zone
    methods: FulfillmentMethod[];
  };
};

export type DeliveryZoneValidationResult = {
  success: boolean;
  error?: { message: string; code?: string };
  data?: {
    isWithinZone: boolean;
    zone: {
      id: string;
      name: string;
      deliveryFee: number;
      minOrderAmount: number | null;
      freeShippingThreshold: number | null;
      estimatedDeliveryTime: string | null;
    } | null;
  };
};

// =============================================================================
// DELIVERY ZONE VALIDATION
// =============================================================================

/**
 * Check if an address is within any delivery zone for the store
 * This should be called before showing shipping options
 */
export async function validateDeliveryZoneAction(
  tenantId: string,
  latitude: number,
  longitude: number
): Promise<DeliveryZoneValidationResult> {
  try {
    // Get active delivery zones for this store
    const zones = await getActiveDeliveryZones(tenantId);

    // If no zones are configured, delivery is allowed everywhere
    if (zones.length === 0) {
      return {
        success: true,
        data: {
          isWithinZone: true,
          zone: null, // No zone restrictions
        },
      };
    }

    // Check if the coordinates are within any zone
    const result = checkDeliveryZone(latitude, longitude, zones);

    if (!result.isWithinZone) {
      return {
        success: true,
        data: {
          isWithinZone: false,
          zone: null,
        },
      };
    }

    return {
      success: true,
      data: {
        isWithinZone: true,
        zone: result.matchingZone
          ? {
              id: result.matchingZone.id,
              name: result.matchingZone.name,
              deliveryFee: result.deliveryFee,
              minOrderAmount: result.minOrderAmount,
              freeShippingThreshold: result.freeShippingThreshold,
              estimatedDeliveryTime: result.estimatedDeliveryTime,
            }
          : null,
      },
    };
  } catch (error) {
    console.error("Failed to validate delivery zone:", error);
    return {
      success: false,
      error: { message: "Failed to validate delivery location" },
    };
  }
}

// =============================================================================
// SHIPPING CALCULATION
// =============================================================================

/**
 * Calculate available fulfillment options for an address
 * Supports dual-mode fulfillment: local delivery zones AND/OR shipping
 *
 * Logic:
 * 1. If unified delivery system is enabled → use new unified zones
 * 2. Otherwise, use legacy system:
 *    - If local delivery enabled AND customer is within a zone → show local delivery option
 *    - If shipping enabled → show shipping methods
 * 3. Both can be shown simultaneously, allowing customer to choose
 */
export async function calculateShippingAction(
  tenantId: string,
  address: Address,
  subtotal: number
): Promise<ShippingCalculationResult> {
  try {
    const sessionId = await getOrCreateCartSessionInAction();
    const user = await getUser();

    // Get cart to calculate weight/item count
    const cartValidation = await validateCartForCheckout(
      tenantId,
      sessionId,
      user?.id
    );

    if (!cartValidation.cart || cartValidation.cart.items.length === 0) {
      return {
        success: false,
        error: { message: "Cart is empty" },
      };
    }

    const cart = cartValidation.cart;

    // =========================================================================
    // CHECK FOR UNIFIED DELIVERY SYSTEM (NEW)
    // =========================================================================
    const unifiedEnabled = await isUnifiedDeliveryEnabled(tenantId);

    if (unifiedEnabled) {
      return calculateShippingWithUnifiedSystem(
        tenantId,
        address,
        subtotal,
        cart.items.length,
        // Calculate total weight if available
        cart.items.reduce((total, item) => {
          const weight = item.product.weight
            ? parseFloat(String(item.product.weight))
            : 0;
          return total + weight * item.quantity;
        }, 0)
      );
    }

    // =========================================================================
    // LEGACY DELIVERY SYSTEM (fallback)
    // =========================================================================

    // Get the tenant's fulfillment settings (both flags)
    const { enableDeliveryZones, enableShipping } =
      await getTenantDeliverySettings(tenantId);

    // Collect all available fulfillment methods
    const methods: FulfillmentMethod[] = [];
    let matchedDeliveryZone: { id: string; name: string } | null = null;
    let deliveryZoneFee = 0;
    let isWithinDeliveryZone = false;

    // =========================================================================
    // 1. CHECK LOCAL DELIVERY ZONES (if enabled)
    // =========================================================================
    if (enableDeliveryZones && address.latitude && address.longitude) {
      const zones = await getActiveDeliveryZones(tenantId);

      if (zones.length > 0) {
        const zoneResult = checkDeliveryZone(
          address.latitude,
          address.longitude,
          zones
        );

        if (zoneResult.isWithinZone && zoneResult.matchingZone) {
          isWithinDeliveryZone = true;
          const matchingZone = zoneResult.matchingZone;
          matchedDeliveryZone = {
            id: matchingZone.id,
            name: matchingZone.name,
          };

          // Apply free shipping threshold if configured
          let effectiveDeliveryFee = zoneResult.deliveryFee;
          const threshold = zoneResult.freeShippingThreshold;
          if (threshold !== null && subtotal >= threshold) {
            effectiveDeliveryFee = 0;
          }
          deliveryZoneFee = effectiveDeliveryFee;

          // Build description with free shipping info
          let description = matchingZone.estimatedDeliveryTime
            ? `Estimated: ${matchingZone.estimatedDeliveryTime}`
            : "Local delivery to your area";
          if (threshold !== null && effectiveDeliveryFee === 0) {
            description = "Free local delivery (order qualifies)";
          } else if (threshold !== null) {
            description += ` (free over ${threshold.toLocaleString()} AFN)`;
          }

          // Add local delivery option
          methods.push({
            id: `zone-${matchingZone.id}`,
            name: `Local Delivery - ${matchingZone.name}`,
            description,
            price: effectiveDeliveryFee,
            basePrice: zoneResult.deliveryFee,
            minDeliveryDays: null,
            maxDeliveryDays: null,
            type: "local_delivery",
            zoneId: matchingZone.id,
          });
        }
      } else if (enableDeliveryZones && !enableShipping) {
        // Delivery zones enabled but none configured, and shipping disabled
        // Offer free delivery as fallback
        methods.push({
          id: "free-local-delivery",
          name: "Free Local Delivery",
          description: "Standard delivery to your location",
          price: 0,
          basePrice: 0,
          minDeliveryDays: null,
          maxDeliveryDays: null,
          type: "local_delivery",
        });
        isWithinDeliveryZone = true;
      }
    }

    // =========================================================================
    // 2. CHECK SHIPPING METHODS (if enabled)
    // =========================================================================
    if (enableShipping) {
      // Convert cart items for shipping calculation
      const cartItemsForShipping: CartItemForShipping[] =
        cartValidation.cart.items.map((item) => ({
          quantity: item.quantity,
          product: {
            weight: null, // TODO: Add weight to cart item type
          },
        }));

      // Get available shipping methods
      const { zone: _zone, methods: shippingMethods } =
        await getAvailableShippingMethods(
          tenantId,
          address,
          cartItemsForShipping,
          subtotal
        );

      // Add shipping methods to the list
      for (const m of shippingMethods) {
        methods.push({
          id: m.id,
          name: m.name,
          description: m.description,
          price: m.calculatedRate,
          basePrice: m.calculatedRate,
          minDeliveryDays: m.minDeliveryDays,
          maxDeliveryDays: m.maxDeliveryDays,
          type: "shipping",
        });
      }

      // If no shipping methods configured but shipping is enabled, offer free shipping
      if (shippingMethods.length === 0 && methods.length === 0) {
        methods.push({
          id: "free-shipping",
          name: "Free Shipping",
          description: "Standard shipping to your location",
          price: 0,
          basePrice: 0,
          minDeliveryDays: null,
          maxDeliveryDays: null,
          type: "shipping",
        });
      }
    }

    // =========================================================================
    // 3. HANDLE EDGE CASES
    // =========================================================================

    // If no methods available at all
    if (methods.length === 0) {
      // If delivery zones are enabled but customer is outside all zones
      // and shipping is disabled → no delivery available
      if (enableDeliveryZones && !enableShipping && !isWithinDeliveryZone) {
        return {
          success: true,
          data: {
            zone: null,
            deliveryZoneFee: 0,
            deliveryZonesEnabled: enableDeliveryZones,
            shippingEnabled: enableShipping,
            isWithinDeliveryZone: false,
            methods: [],
          },
        };
      }
    }

    // Sort methods: local delivery first, then by price
    methods.sort((a, b) => {
      if (a.type === "local_delivery" && b.type !== "local_delivery") return -1;
      if (a.type !== "local_delivery" && b.type === "local_delivery") return 1;
      return a.price - b.price;
    });

    return {
      success: true,
      data: {
        zone: matchedDeliveryZone,
        deliveryZoneFee,
        deliveryZonesEnabled: enableDeliveryZones,
        shippingEnabled: enableShipping,
        isWithinDeliveryZone,
        methods,
      },
    };
  } catch (error) {
    console.error("Failed to calculate shipping:", error);
    return {
      success: false,
      error: { message: "Failed to calculate shipping options" },
    };
  }
}

// =============================================================================
// UNIFIED DELIVERY SYSTEM INTEGRATION
// =============================================================================

/**
 * Calculate shipping using the unified delivery system
 * Maps unified zone/method results to FulfillmentMethod format
 */
async function calculateShippingWithUnifiedSystem(
  tenantId: string,
  address: Address,
  subtotal: number,
  itemCount: number,
  totalWeightKg: number
): Promise<ShippingCalculationResult> {
  // Build location input for unified system
  // MatchLocationInput uses lat/lng (not latitude/longitude)
  // Address type only has city from reverse geocoding, no country/region/postalCode
  const locationInput = {
    lat: address.latitude,
    lng: address.longitude,
    city: address.city,
    // country, region, postalCode are not available in Address type
    // Radius and polygon zones will still work with lat/lng coordinates
  };

  // Get delivery options from unified system
  const result = await getDeliveryOptions(tenantId, locationInput, {
    subtotal,
    itemCount,
    totalWeightKg: totalWeightKg > 0 ? totalWeightKg : undefined,
  });

  if (!result.success) {
    return {
      success: false,
      error: {
        message: result.error || "Failed to calculate delivery options",
      },
    };
  }

  // Map unified zones/methods to FulfillmentMethod format
  const methods: FulfillmentMethod[] = [];
  let matchedDeliveryZone: { id: string; name: string } | null = null;
  let deliveryZoneFee = 0;
  let isWithinDeliveryZone = false;

  if (result.zones && result.zones.length > 0) {
    // Process each matched zone
    for (const zoneMatch of result.zones) {
      const zone = zoneMatch.zone;

      // For local delivery zones (radius/polygon), track as delivery zone
      if (zone.zoneType === "radius" || zone.zoneType === "polygon") {
        isWithinDeliveryZone = true;
        if (!matchedDeliveryZone) {
          matchedDeliveryZone = { id: zone.id, name: zone.name };
        }
      }

      // Add each rate as a fulfillment method
      // CalculatedRate has: methodId, methodName, rate, isFree, freeReason, deliveryEstimate
      for (const rate of zoneMatch.rates) {
        // Determine fulfillment type based on zone type
        const isLocalDelivery =
          zone.zoneType === "radius" || zone.zoneType === "polygon";

        // Track delivery zone fee for first local delivery method
        if (isLocalDelivery && deliveryZoneFee === 0) {
          deliveryZoneFee = rate.rate;
        }

        // Build description
        let description = rate.deliveryEstimate || "";
        if (rate.isFree && rate.freeReason) {
          description = rate.freeReason;
        }

        methods.push({
          id: `unified-${zone.id}-${rate.methodId}`,
          name: `${zone.name} - ${rate.methodName}`,
          description,
          price: rate.rate,
          basePrice: rate.rate,
          minDeliveryDays: null, // Not available in CalculatedRate
          maxDeliveryDays: null, // Not available in CalculatedRate
          type: isLocalDelivery ? "local_delivery" : "shipping",
          zoneId: isLocalDelivery ? zone.id : undefined,
        });
      }
    }
  }

  // If no methods available, offer free shipping as fallback
  if (methods.length === 0) {
    methods.push({
      id: "unified-free-shipping",
      name: "Free Shipping",
      description: "Standard delivery to your location",
      price: 0,
      basePrice: 0,
      minDeliveryDays: null,
      maxDeliveryDays: null,
      type: "shipping",
    });
  }

  // Sort methods: local delivery first, then by price
  methods.sort((a, b) => {
    if (a.type === "local_delivery" && b.type !== "local_delivery") return -1;
    if (a.type !== "local_delivery" && b.type === "local_delivery") return 1;
    return a.price - b.price;
  });

  return {
    success: true,
    data: {
      zone: matchedDeliveryZone,
      deliveryZoneFee,
      deliveryZonesEnabled: true, // Unified system always has zones enabled
      shippingEnabled: true,
      isWithinDeliveryZone,
      methods,
    },
  };
}

// =============================================================================
// ORDER NUMBER GENERATION
// =============================================================================

/**
 * Generate next order number for a tenant
 * Format: KM-{YEAR}-{PADDED_SEQUENCE}
 */
async function generateOrderNumber(
  tx: Transaction,
  tenantId: string
): Promise<string> {
  const year = new Date().getFullYear();

  // Count existing orders for this tenant this year
  const result = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        sql`EXTRACT(YEAR FROM ${orders.createdAt}) = ${year}`
      )
    );

  const nextNumber = (result[0]?.count || 0) + 1;
  const paddedNumber = String(nextNumber).padStart(6, "0");

  return `KM-${year}-${paddedNumber}`;
}

// =============================================================================
// STORE CUSTOMER MANAGEMENT
// =============================================================================

/**
 * Get or create store customer record for a user
 */
async function getOrCreateStoreCustomer(
  tx: Transaction,
  tenantId: string,
  userId: string
): Promise<{ id: string; isNew: boolean }> {
  // Try to find existing
  const existing = await tx.query.storeCustomers.findFirst({
    where: and(
      eq(storeCustomers.tenantId, tenantId),
      eq(storeCustomers.userId, userId)
    ),
    columns: { id: true },
  });

  if (existing) {
    return { id: existing.id, isNew: false };
  }

  // Create new
  const [newCustomer] = await tx
    .insert(storeCustomers)
    .values({
      tenantId,
      userId,
      marketingConsent: false,
    })
    .returning({ id: storeCustomers.id });

  return { id: newCustomer.id, isNew: true };
}

// =============================================================================
// ORDER CREATION
// =============================================================================

/**
 * Create order from checkout data
 * This is the main checkout action that:
 * 1. Validates cart
 * 2. Creates order and order items
 * 3. Reduces stock and creates inventory movements
 * 4. Creates/updates store customer record
 * 5. Clears cart
 */
export async function createOrderAction(
  tenantId: string,
  storeSlug: string,
  input: CheckoutSubmitInput
): Promise<CheckoutResult> {
  try {
    // Validate input
    const validation = checkoutSubmitSchema.safeParse(input);
    if (!validation.success) {
      // Get the first validation error for a helpful message
      const firstError = validation.error.issues[0];
      const fieldPath = firstError?.path.join(".") || "unknown";
      const errorMessage = firstError?.message || "Invalid data";
      console.error("Checkout validation failed:", validation.error.issues);
      return {
        success: false,
        error: {
          message: `${errorMessage} (${fieldPath})`,
          code: "VALIDATION_ERROR",
        },
      };
    }

    const sessionId = await getOrCreateCartSessionInAction();
    const user = await getUser();

    // Validate cart before starting transaction
    const cartValidation = await validateCartForCheckout(
      tenantId,
      sessionId,
      user?.id
    );

    if (!cartValidation.cart) {
      return {
        success: false,
        error: {
          message: "Cart not found",
          code: "CART_NOT_FOUND",
        },
      };
    }

    if (cartValidation.cart.items.length === 0) {
      return {
        success: false,
        error: {
          message: "Cart is empty",
          code: "CART_EMPTY",
        },
      };
    }

    if (!cartValidation.valid) {
      return {
        success: false,
        error: {
          message: "Some items in your cart are no longer available",
          code: "CART_INVALID",
          cartErrors: cartValidation.errors,
        },
      };
    }

    const cart = cartValidation.cart;

    // Fetch product categoryIds for campaign matching
    const cartProductIds = cart.items.map((item) => item.productId);
    const productCategoryRows =
      cartProductIds.length > 0
        ? await db.query.products.findMany({
            where: inArray(products.id, cartProductIds),
            columns: { id: true, categoryId: true },
          })
        : [];
    const categoryMap = new Map(
      productCategoryRows.map((p) => [p.id, p.categoryId])
    );

    // Fetch active campaign discounts
    const campaignDiscounts = await getProductsCampaignDiscounts(
      tenantId,
      cart.items.map((item) => ({
        productId: item.productId,
        categoryId: categoryMap.get(item.productId) ?? null,
      }))
    );

    // Calculate subtotal with campaign discounts + tier pricing
    const subtotal = cart.items.reduce((sum, item) => {
      const basePrice = item.variant?.price
        ? parseFloat(item.variant.price)
        : parseFloat(item.product.price);

      // Apply campaign discount first
      const campaign = campaignDiscounts.get(item.productId);
      const afterCampaignPrice = campaign
        ? applyCampaignDiscount(basePrice, campaign)
        : basePrice;

      // Then apply tier pricing
      const effectivePrice = getApplicableTierPrice(
        afterCampaignPrice,
        item.quantity,
        item.product.priceTiers || []
      );
      return sum + effectivePrice * item.quantity;
    }, 0);

    // Fill in shipping address name from user if not provided (logged-in users)
    let firstName = input.shippingAddress.firstName || "";
    let lastName = input.shippingAddress.lastName || "";
    if (user?.name && !firstName && !lastName) {
      const nameParts = user.name.trim().split(/\s+/);
      firstName = nameParts[0] || "";
      lastName = nameParts.slice(1).join(" ") || "";
    }

    // Build customer snapshot
    // For guests: phone only (no name collected), use phone as identifier
    // For logged-in: name from user, email from user, phone from shipping address
    const customerSnapshot: CustomerSnapshot = input.customerInfo
      ? {
          // Guest checkout - phone is the primary identifier
          // Name uses phone number since we don't collect name for guests
          name: input.customerInfo.phone,
          phone: input.customerInfo.phone,
          email: undefined, // Not collected in phone-first guest checkout
        }
      : {
          // Logged-in user
          name: user?.name || "Customer",
          phone: input.shippingAddress.phone, // Use phone from shipping address
          email: user?.email,
        };

    const shippingAddress: Address = {
      firstName,
      lastName,
      phone: input.shippingAddress.phone,
      latitude: input.shippingAddress.latitude,
      longitude: input.shippingAddress.longitude,
      h3Index: input.shippingAddress.h3Index,
      plusCode: input.shippingAddress.plusCode,
      city: input.shippingAddress.city,
      accuracy: input.shippingAddress.accuracy,
      source: input.shippingAddress.source,
      notes: input.shippingAddress.notes,
    };

    // Fill in billing address name from user if not provided
    let billingAddress: Address | null = null;
    if (input.billingAddress) {
      let billingFirstName = input.billingAddress.firstName || "";
      let billingLastName = input.billingAddress.lastName || "";
      if (user?.name && !billingFirstName && !billingLastName) {
        const nameParts = user.name.trim().split(/\s+/);
        billingFirstName = nameParts[0] || "";
        billingLastName = nameParts.slice(1).join(" ") || "";
      }
      billingAddress = {
        firstName: billingFirstName,
        lastName: billingLastName,
        phone: input.billingAddress.phone,
        latitude: input.billingAddress.latitude,
        longitude: input.billingAddress.longitude,
        h3Index: input.billingAddress.h3Index,
        plusCode: input.billingAddress.plusCode,
        city: input.billingAddress.city,
        accuracy: input.billingAddress.accuracy,
        source: input.billingAddress.source,
        notes: input.billingAddress.notes,
      };
    }

    // Get the tenant's fulfillment settings
    const { enableDeliveryZones, enableShipping } =
      await getTenantDeliverySettings(tenantId);

    let shippingTotal = 0;
    let deliveryZoneFee = 0;

    // Check if unified delivery system is enabled
    const unifiedEnabled = await isUnifiedDeliveryEnabled(tenantId);

    // Determine if the selected method is from the unified system
    const isUnifiedMethod = input.shippingMethodId?.startsWith("unified-");

    // Determine if the selected method is a local delivery zone (legacy)
    const isLocalDeliveryMethod =
      input.shippingMethodId?.startsWith("zone-") ||
      input.shippingMethodId === "free-local-delivery";

    // ==========================================================================
    // UNIFIED DELIVERY PATH (NEW SYSTEM)
    // ==========================================================================
    if (isUnifiedMethod && unifiedEnabled) {
      // Recalculate shipping using unified system to get the correct price
      const unifiedResult = await calculateShippingWithUnifiedSystem(
        tenantId,
        shippingAddress,
        subtotal,
        cart.items.length,
        cart.items.reduce((total, item) => {
          const weight = item.product.weight
            ? parseFloat(String(item.product.weight))
            : 0;
          return total + weight * item.quantity;
        }, 0)
      );

      if (unifiedResult.success && unifiedResult.data) {
        // Find the selected method in the results
        const selectedMethod = unifiedResult.data.methods.find(
          (m) => m.id === input.shippingMethodId
        );

        if (selectedMethod) {
          shippingTotal = selectedMethod.price;
          deliveryZoneFee =
            selectedMethod.type === "local_delivery" ? selectedMethod.price : 0;
        } else {
          // Method not found, check if any methods are available
          if (unifiedResult.data.methods.length > 0) {
            return {
              success: false,
              error: {
                message:
                  "Selected delivery method is no longer available. Please choose another option.",
                code: "DELIVERY_METHOD_NOT_FOUND",
              },
            };
          }
          // No methods available at all
          shippingTotal = 0;
        }
      } else {
        return {
          success: false,
          error: {
            message:
              unifiedResult.error?.message || "Failed to calculate shipping",
            code: "UNIFIED_DELIVERY_ERROR",
          },
        };
      }
    }
    // ==========================================================================
    // LOCAL DELIVERY PATH (LEGACY)
    // ==========================================================================
    else if (isLocalDeliveryMethod && enableDeliveryZones) {
      const deliveryZoneResult = await validateDeliveryZoneAction(
        tenantId,
        shippingAddress.latitude,
        shippingAddress.longitude
      );

      if (!deliveryZoneResult.success) {
        return {
          success: false,
          error: {
            message:
              deliveryZoneResult.error?.message ||
              "Failed to validate delivery location",
            code: "DELIVERY_ZONE_ERROR",
          },
        };
      }

      if (deliveryZoneResult.data && !deliveryZoneResult.data.isWithinZone) {
        return {
          success: false,
          error: {
            message:
              "Sorry, we don't deliver to this location. Please check our delivery zones or select a shipping option.",
            code: "OUTSIDE_DELIVERY_ZONE",
          },
        };
      }

      // Check minimum order requirement for the delivery zone
      const deliveryZone = deliveryZoneResult.data?.zone;
      if (
        deliveryZone?.minOrderAmount &&
        subtotal < deliveryZone.minOrderAmount
      ) {
        return {
          success: false,
          error: {
            message: `Minimum order for local delivery to this area is ${deliveryZone.minOrderAmount.toLocaleString()} AFN. Your order total is ${subtotal.toLocaleString()} AFN.`,
            code: "MIN_ORDER_NOT_MET",
          },
        };
      }

      // Use delivery zone fee as shipping total, applying free shipping threshold if applicable
      deliveryZoneFee = deliveryZone?.deliveryFee ?? 0;
      const freeThreshold = deliveryZone?.freeShippingThreshold;
      if (
        freeThreshold !== null &&
        freeThreshold !== undefined &&
        subtotal >= freeThreshold
      ) {
        deliveryZoneFee = 0;
      }
      shippingTotal = deliveryZoneFee;
    }
    // ==========================================================================
    // SHIPPING PATH
    // ==========================================================================
    else if (input.shippingMethodId && enableShipping) {
      // Check for synthetic shipping method IDs (not stored in database)
      const isSyntheticMethod =
        input.shippingMethodId === "free-shipping" ||
        input.shippingMethodId === "free-delivery";

      if (isSyntheticMethod) {
        // Synthetic methods have zero shipping cost
        shippingTotal = 0;
      } else {
        // Look up actual shipping method from database
        const selectedMethod = await db.query.shippingMethods.findFirst({
          where: and(
            eq(shippingMethods.id, input.shippingMethodId),
            eq(shippingMethods.tenantId, tenantId),
            eq(shippingMethods.isActive, true)
          ),
        });

        if (selectedMethod) {
          // Convert cart items for shipping calculation
          const cartItemsForShipping: CartItemForShipping[] = cart.items.map(
            (item) => ({
              quantity: item.quantity,
              product: {
                weight: item.product.weight || null,
              },
            })
          );

          // Calculate shipping method rate
          const methodRate = calculateShippingRate(
            selectedMethod,
            cartItemsForShipping,
            subtotal
          );

          if (methodRate >= 0) {
            shippingTotal = methodRate;
          }
        }
      }
    }
    // ==========================================================================
    // NO METHOD SELECTED - VALIDATION
    // ==========================================================================
    else if (!input.shippingMethodId) {
      // Check if any fulfillment methods are available
      const hasShippingMethods =
        enableShipping &&
        (await db.query.shippingMethods.findFirst({
          where: and(
            eq(shippingMethods.tenantId, tenantId),
            eq(shippingMethods.isActive, true)
          ),
          columns: { id: true },
        }));

      const hasDeliveryZones =
        enableDeliveryZones &&
        (await getActiveDeliveryZones(tenantId)).length > 0;

      if (hasShippingMethods || hasDeliveryZones) {
        return {
          success: false,
          error: {
            message: "Please select a delivery or shipping method",
            code: "FULFILLMENT_METHOD_REQUIRED",
          },
        };
      }
      // If no methods configured at all, allow free shipping
      shippingTotal = 0;
    }

    // ==========================================================================
    // COUPON VALIDATION & DISCOUNT CALCULATION
    // ==========================================================================
    let discountTotal = 0;
    let validatedCoupon: {
      id: string;
      code: string;
      name: string;
      type: string;
      value: string;
      scope: string;
    } | null = null;

    if (input.appliedCouponCode) {
      // Build cart items for coupon validation (using campaign + tier prices)
      const cartItemsForCoupon: CartItemForCoupon[] = cart.items.map((item) => {
        const basePrice = item.variant?.price
          ? parseFloat(item.variant.price)
          : parseFloat(item.product.price);
        const itemCampaign = campaignDiscounts.get(item.productId);
        const afterCampaignPrice = itemCampaign
          ? applyCampaignDiscount(basePrice, itemCampaign)
          : basePrice;
        const effectivePrice = getApplicableTierPrice(
          afterCampaignPrice,
          item.quantity,
          item.product.priceTiers || []
        );
        return {
          productId: item.productId,
          categoryId: categoryMap.get(item.productId) ?? null,
          quantity: item.quantity,
          lineTotal: effectivePrice * item.quantity,
        };
      });

      // Get store customer ID for per-customer limit check
      let storeCustomerIdForCoupon: string | null = null;
      if (user?.id) {
        const existingCustomer = await db.query.storeCustomers.findFirst({
          where: and(
            eq(storeCustomers.tenantId, tenantId),
            eq(storeCustomers.userId, user.id)
          ),
          columns: { id: true },
        });
        storeCustomerIdForCoupon = existingCustomer?.id || null;
      }

      // Validate the coupon
      const couponResult = await validateCouponAction(
        tenantId,
        input.appliedCouponCode,
        subtotal,
        cartItemsForCoupon,
        storeCustomerIdForCoupon
      );

      if (couponResult.valid) {
        validatedCoupon = couponResult.coupon;
        discountTotal = couponResult.discountAmount;

        // Handle free_shipping coupon type
        if (validatedCoupon.type === "free_shipping") {
          discountTotal = shippingTotal; // Discount equals the shipping cost
          shippingTotal = 0; // Zero out shipping
        }
      }
      // If coupon validation fails, we silently ignore it and proceed without discount
      // The user already saw the validation error in the UI
    }

    // Fetch the store's currency for the order
    const tenantForCurrency = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      columns: { currency: true },
    });
    const storeCurrency = tenantForCurrency?.currency || "AFN";

    try {
      const order = await withTransaction(async (tx) => {
        // 1. Generate order number
        const orderNumber = await generateOrderNumber(tx, tenantId);

        // 2. Create store customer record if user is logged in
        let storeCustomerId: string | null = null;
        if (user?.id) {
          const storeCustomer = await getOrCreateStoreCustomer(
            tx,
            tenantId,
            user.id
          );
          storeCustomerId = storeCustomer.id;
        }

        // 3. Calculate total (including discount)
        const total = subtotal + shippingTotal - discountTotal;

        // 4. Map payment gateway to payment method
        const paymentGateway = input.paymentMethod || "cod";
        const paymentMethod = mapGatewayToPaymentMethod(paymentGateway);

        // 5. Create order record
        const [newOrder] = await tx
          .insert(orders)
          .values({
            tenantId,
            orderNumber,
            userId: user?.id || null,
            storeCustomerId,
            customerSnapshot,
            shippingAddress,
            billingAddress,
            subtotal: subtotal.toFixed(2),
            shippingTotal: shippingTotal.toFixed(2),
            taxTotal: "0",
            discountTotal: discountTotal.toFixed(2),
            total: total.toFixed(2),
            amountDue: total.toFixed(2),
            currencyCode: storeCurrency,
            // Multi-currency: record customer's display currency and locked exchange rate
            customerCurrency: input.customerCurrency || null,
            customerAmount:
              input.customerCurrency &&
              input.exchangeRateUsed &&
              input.customerCurrency !== storeCurrency
                ? (total * input.exchangeRateUsed).toFixed(2)
                : null,
            exchangeRateUsed: input.exchangeRateUsed
              ? input.exchangeRateUsed.toString()
              : null,
            exchangeRateLockedAt: input.exchangeRateLockedAt || null,
            status: "pending",
            paymentStatus: paymentGateway === "cod" ? "unpaid" : "unpaid", // Both start unpaid
            paymentMethod,
            customerNotes: input.customerNotes || null,
            metadata: {
              paymentGateway, // Track the original gateway for payment processing
            },
          })
          .returning();

        // 6. Create order items with snapshots (using campaign + tier pricing)
        for (const item of cart.items) {
          const basePrice = item.variant?.price
            ? parseFloat(item.variant.price)
            : parseFloat(item.product.price);

          // Apply campaign discount first
          const itemCampaign = campaignDiscounts.get(item.productId);
          const afterCampaignPrice = itemCampaign
            ? applyCampaignDiscount(basePrice, itemCampaign)
            : basePrice;

          // Then apply tier pricing
          const effectivePrice = getApplicableTierPrice(
            afterCampaignPrice,
            item.quantity,
            item.product.priceTiers || []
          );

          await tx.insert(orderItems).values({
            orderId: newOrder.id,
            productId: item.productId,
            variantId: item.variantId || null,
            productName: item.product.name,
            variantName: item.variant?.displayName || null,
            sku: null,
            price: effectivePrice.toFixed(2),
            unitPrice: effectivePrice.toFixed(2),
            quantity: item.quantity,
            lineSubtotal: (effectivePrice * item.quantity).toFixed(2),
            lineTotal: (effectivePrice * item.quantity).toFixed(2),
          });
        }

        // 7. Reduce stock and create inventory movements
        for (const item of cart.items) {
          if (!item.product.trackInventory) continue;

          const currentStock = item.variant
            ? item.variant.stock
            : item.product.stock;
          const newStock = Math.max(0, currentStock - item.quantity);

          if (item.variantId && item.variant) {
            // Update variant stock
            await tx
              .update(productVariants)
              .set({
                stock: newStock,
                stockStatus:
                  newStock === 0
                    ? "out_of_stock"
                    : newStock <= 5
                      ? "low_stock"
                      : "in_stock",
                updatedAt: new Date().toISOString(),
              })
              .where(eq(productVariants.id, item.variantId));
          } else {
            // Update product stock
            await tx
              .update(products)
              .set({
                stock: newStock,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(products.id, item.productId));
          }

          // Create inventory movement
          await tx.insert(inventoryMovements).values({
            tenantId,
            productId: item.productId,
            variantId: item.variantId || null,
            type: "sale",
            quantity: -item.quantity,
            previousStock: currentStock,
            newStock,
            orderId: newOrder.id,
            reason: `Order ${orderNumber}`,
          });
        }

        // 8. Update store customer stats (if applicable)
        if (storeCustomerId) {
          await tx
            .update(storeCustomers)
            .set({
              totalOrders: sql`${storeCustomers.totalOrders} + 1`,
              totalSpent: sql`${storeCustomers.totalSpent} + ${total}`,
              lastOrderAt: new Date().toISOString(),
              firstOrderAt: sql`COALESCE(${storeCustomers.firstOrderAt}, NOW())`,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(storeCustomers.id, storeCustomerId));
        }

        // 9. Record coupon usage (if coupon was applied)
        if (validatedCoupon && discountTotal > 0) {
          await recordCouponUsage(
            tx,
            validatedCoupon.id,
            newOrder.id,
            storeCustomerId,
            discountTotal
          );
          await createOrderDiscountRecord(
            tx,
            newOrder.id,
            validatedCoupon,
            discountTotal
          );
        }

        // 10. Clear cart items
        await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));

        return newOrder;
      });

      // Only clear cart session for COD (offline payment)
      // For online payments (HesabPay, Stripe), keep session until payment is confirmed
      // This prevents session errors during redirect and allows retry if payment fails
      const isOfflinePayment = input.paymentMethod === "cod";
      if (isOfflinePayment) {
        await clearCartSession();
      }

      // Revalidate relevant paths
      revalidatePath(`/store/${storeSlug}`);
      revalidatePath(`/store/${storeSlug}/cart`);
      if (user) {
        revalidatePath(`/store/${storeSlug}/account/orders`);
      }

      // Send push notification to store owners/admins (non-blocking)
      // Extract product names for notification (up to first 5)
      const productNames = cart.items
        .slice(0, 5)
        .map((item) => item.product.name);

      // Get store name for notification
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
        columns: { name: true },
      });

      // Notify all store staff about the new order (including the owner)
      sendOrderNotificationToTenant(tenantId, storeSlug, {
        orderNumber: order.orderNumber,
        orderId: order.id,
        customerName: order.customerSnapshot.name,
        total: order.total,
        currency: storeCurrency,
        isOffline: false,
        storeName: tenant?.name,
        productNames,
      }).catch((error) => {
        console.error("Failed to send order notification:", error);
      });

      return {
        success: true,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
        },
      };
    } catch (error) {
      // Check for specific error types
      if (error instanceof Error) {
        if (error.message.includes("unique constraint")) {
          // Retry with new order number (shouldn't happen, but safety net)
          console.error("Order number collision, retrying:", error);
          return createOrderAction(tenantId, storeSlug, input);
        }
      }
      throw error;
    }
  } catch (error) {
    console.error("Order creation failed:", error);
    return {
      success: false,
      error: {
        message: "Failed to create order. Please try again.",
        code: "ORDER_CREATION_FAILED",
      },
    };
  }
}

/**
 * Validate cart before checkout (client can call this to check early)
 */
export async function validateCartAction(tenantId: string) {
  const sessionId = await getOrCreateCartSessionInAction();
  const user = await getUser();

  const result = await validateCartForCheckout(tenantId, sessionId, user?.id);

  return {
    valid: result.valid,
    errors: result.errors,
    isEmpty: !result.cart || result.cart.items.length === 0,
  };
}

/**
 * Clear cart session (Server Action - safe to call from client)
 * Used after successful checkout to clear the cart cookie
 */
export async function clearCartSessionAction(): Promise<void> {
  await clearCartSession();
}
