"use server";

import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
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
} from "@/lib/validations/checkout";
import type { CartPriceTier } from "@/lib/db/queries/carts";
import { getActiveDeliveryZones } from "@/lib/actions/delivery-zones";
import { checkDeliveryZone } from "@/lib/geo/delivery-zone-check";
import { sendOrderNotificationToTenant } from "@/lib/push";

// =============================================================================
// DELIVERY SETTINGS HELPER
// =============================================================================

/**
 * Get the tenant's delivery zone settings
 * Uses direct SQL query to bypass any potential caching
 */
async function getTenantDeliverySettings(
  tenantId: string
): Promise<{ enableDeliveryZones: boolean }> {
  // Use direct query to ensure fresh data (no Next.js data cache)
  const result = await db
    .select({ enableDeliveryZones: tenants.enableDeliveryZones })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return { enableDeliveryZones: result[0]?.enableDeliveryZones ?? false };
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
    methods: Array<{
      id: string;
      name: string;
      description: string | null;
      price: number; // Total price (delivery zone fee + method rate)
      basePrice?: number; // Method-only rate (without delivery zone fee)
      minDeliveryDays: number | null;
      maxDeliveryDays: number | null;
    }>;
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
 * Calculate available shipping methods for an address
 * Returns shipping methods with prices that include delivery zone base fee
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

    // Get the tenant's delivery settings
    const { enableDeliveryZones } = await getTenantDeliverySettings(tenantId);

    // When delivery zones are enabled: Use GPS-based delivery zones
    if (enableDeliveryZones) {
      if (!address.latitude || !address.longitude) {
        return {
          success: false,
          error: { message: "Location coordinates are required for delivery" },
        };
      }

      const zones = await getActiveDeliveryZones(tenantId);

      // If no delivery zones configured, offer free delivery from anywhere
      if (zones.length === 0) {
        return {
          success: true,
          data: {
            zone: null,
            deliveryZoneFee: 0,
            deliveryZonesEnabled: true,
            methods: [
              {
                id: "free-delivery",
                name: "Free Delivery",
                description: "Standard delivery to your location",
                price: 0,
                basePrice: 0,
                minDeliveryDays: null,
                maxDeliveryDays: null,
              },
            ],
          },
        };
      }

      const zoneResult = checkDeliveryZone(
        address.latitude,
        address.longitude,
        zones
      );

      if (!zoneResult.isWithinZone || !zoneResult.matchingZone) {
        return {
          success: true,
          data: {
            zone: null,
            deliveryZoneFee: 0,
            deliveryZonesEnabled: true,
            methods: [],
          },
        };
      }

      const matchingZone = zoneResult.matchingZone;

      // Apply free shipping threshold if configured
      let effectiveDeliveryFee = zoneResult.deliveryFee;
      const threshold = zoneResult.freeShippingThreshold;
      if (threshold !== null && subtotal >= threshold) {
        effectiveDeliveryFee = 0;
      }

      // Build description with free shipping info
      let description = matchingZone.estimatedDeliveryTime
        ? `Estimated: ${matchingZone.estimatedDeliveryTime}`
        : "Standard delivery to your area";
      if (threshold !== null && effectiveDeliveryFee === 0) {
        description = "Free delivery (order qualifies)";
      } else if (threshold !== null) {
        description += ` (free over ${threshold.toLocaleString()} AFN)`;
      }

      // Create a synthetic delivery method from the zone
      return {
        success: true,
        data: {
          zone: { id: matchingZone.id, name: matchingZone.name },
          deliveryZoneFee: effectiveDeliveryFee,
          deliveryZonesEnabled: true,
          methods: [
            {
              id: `zone-${matchingZone.id}`,
              name: matchingZone.name,
              description,
              price: effectiveDeliveryFee,
              basePrice: zoneResult.deliveryFee,
              minDeliveryDays: null,
              maxDeliveryDays: null,
            },
          ],
        },
      };
    }

    // When delivery zones are disabled: Use shipping methods (if configured)
    // Convert cart items for shipping calculation
    const cartItemsForShipping: CartItemForShipping[] =
      cartValidation.cart.items.map((item) => ({
        quantity: item.quantity,
        product: {
          weight: null, // TODO: Add weight to cart item type
        },
      }));

    // Get available shipping methods
    const { zone, methods } = await getAvailableShippingMethods(
      tenantId,
      address,
      cartItemsForShipping,
      subtotal
    );

    return {
      success: true,
      data: {
        zone: zone ? { id: zone.id, name: zone.name } : null,
        deliveryZoneFee: 0,
        deliveryZonesEnabled: false,
        methods: methods.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          price: m.calculatedRate,
          basePrice: m.calculatedRate,
          minDeliveryDays: m.minDeliveryDays,
          maxDeliveryDays: m.maxDeliveryDays,
        })),
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

    // Calculate subtotal with tier pricing
    const subtotal = cart.items.reduce((sum, item) => {
      const basePrice = item.variant?.price
        ? parseFloat(item.variant.price)
        : parseFloat(item.product.price);
      const effectivePrice = getApplicableTierPrice(
        basePrice,
        item.quantity,
        item.product.priceTiers || []
      );
      return sum + effectivePrice * item.quantity;
    }, 0);

    // Build customer snapshot
    const customerSnapshot: CustomerSnapshot = input.customerInfo
      ? {
          name: `${input.customerInfo.firstName} ${input.customerInfo.lastName}`,
          email: input.customerInfo.email,
          phone: input.customerInfo.phone,
        }
      : {
          name: user?.name || "Customer",
          email: user?.email || "",
          phone: undefined,
        };

    // Fill in shipping address name from user if not provided (logged-in users)
    let firstName = input.shippingAddress.firstName || "";
    let lastName = input.shippingAddress.lastName || "";
    if (user?.name && !firstName && !lastName) {
      const nameParts = user.name.trim().split(/\s+/);
      firstName = nameParts[0] || "";
      lastName = nameParts.slice(1).join(" ") || "";
    }

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

    // Get the tenant's delivery settings
    const { enableDeliveryZones } = await getTenantDeliverySettings(tenantId);

    let shippingTotal = 0;
    let deliveryZoneFee = 0;

    // When delivery zones are enabled: Validate GPS-based delivery zones
    if (enableDeliveryZones) {
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
              "Sorry, we don't deliver to this location. Please check our delivery zones.",
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
            message: `Minimum order for delivery to this area is ${deliveryZone.minOrderAmount.toLocaleString()} AFN. Your order total is ${subtotal.toLocaleString()} AFN.`,
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
    } else if (input.shippingMethodId) {
      // When delivery zones are disabled: Use the selected shipping method
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
    } else if (!enableDeliveryZones) {
      // When delivery zones are disabled, a shipping method is required (unless none configured)
      // Check if any shipping methods are configured
      const hasShippingMethods = await db.query.shippingMethods.findFirst({
        where: and(
          eq(shippingMethods.tenantId, tenantId),
          eq(shippingMethods.isActive, true)
        ),
        columns: { id: true },
      });

      if (hasShippingMethods) {
        return {
          success: false,
          error: {
            message: "Please select a shipping method",
            code: "SHIPPING_METHOD_REQUIRED",
          },
        };
      }
      // If no shipping methods configured, allow free shipping
      shippingTotal = 0;
    }

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

        // 3. Calculate total
        const total = subtotal + shippingTotal;

        // 4. Create order record
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
            discountTotal: "0",
            total: total.toFixed(2),
            status: "pending",
            customerNotes: input.customerNotes || null,
          })
          .returning();

        // 5. Create order items with snapshots (using tier pricing)
        for (const item of cart.items) {
          const basePrice = item.variant?.price
            ? parseFloat(item.variant.price)
            : parseFloat(item.product.price);
          const effectivePrice = getApplicableTierPrice(
            basePrice,
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

        // 6. Reduce stock and create inventory movements
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

        // 7. Update store customer stats (if applicable)
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

        // 8. Clear cart items
        await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));

        return newOrder;
      });

      // Clear cart session cookie
      await clearCartSession();

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

      sendOrderNotificationToTenant(tenantId, storeSlug, {
        orderNumber: order.orderNumber,
        orderId: order.id,
        customerName: order.customerSnapshot.name,
        total: order.total,
        currency: "AFN",
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
