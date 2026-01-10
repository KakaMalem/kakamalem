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
  type CartItemForShipping,
} from "@/lib/db/queries/shipping";
import {
  checkoutSubmitSchema,
  type CheckoutSubmitInput,
} from "@/lib/validations/checkout";
import type { CartPriceTier } from "@/lib/db/queries/carts";

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

  const sortedTiers = [...priceTiers].sort((a, b) => b.minQuantity - a.minQuantity);

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
    methods: Array<{
      id: string;
      name: string;
      description: string | null;
      price: number;
      minDeliveryDays: number | null;
      maxDeliveryDays: number | null;
    }>;
  };
};

// =============================================================================
// SHIPPING CALCULATION
// =============================================================================

/**
 * Calculate available shipping methods for an address
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
        methods: methods.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          price: m.calculatedRate,
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
      return {
        success: false,
        error: {
          message: "Invalid checkout data",
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

    // Get shipping method details to calculate shipping total
    // For now, we trust the frontend-provided method ID and look up the rate
    // TODO: Re-calculate shipping to prevent manipulation
    const shippingTotal = 0; // Will be set from selected method

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
            shippingAddress: input.shippingAddress,
            billingAddress: input.billingAddress,
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
            quantity: item.quantity,
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
