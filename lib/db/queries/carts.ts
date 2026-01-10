"use server";

import { db } from "@/lib/db";
import { carts, cartItems, products, productVariants } from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

// ============================================================================
// TYPES
// ============================================================================

export type CartPriceTier = {
  id: string;
  minQuantity: number;
  maxQuantity: number | null;
  price: string;
};

export type CartItemWithProduct = {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    price: string;
    stock: number;
    trackInventory: boolean;
    allowBackorder: boolean;
    status: "draft" | "active" | "archived";
    hasVariants: boolean;
    image: {
      url: string;
      altText: string | null;
    } | null;
    priceTiers: CartPriceTier[];
  };
  variant: {
    id: string;
    displayName: string | null;
    price: string | null;
    stock: number;
    isActive: boolean;
  } | null;
};

export type Cart = {
  id: string;
  tenantId: string;
  sessionId: string | null;
  customerId: string | null;
  items: CartItemWithProduct[];
  createdAt: string;
  updatedAt: string;
};

export type CartSummary = {
  itemCount: number;
  subtotal: number;
};

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get or create a cart for a session/customer
 */
export async function getOrCreateCart(
  tenantId: string,
  sessionId: string,
  customerId?: string | null
): Promise<Cart> {
  // Try to find existing cart
  let cart = await findCart(tenantId, sessionId, customerId);

  if (!cart) {
    // Create new cart
    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString(); // 30 days
    const [newCart] = await db
      .insert(carts)
      .values({
        tenantId,
        sessionId,
        userId: customerId || null,
        expiresAt,
      })
      .returning();

    cart = {
      id: newCart.id,
      tenantId: newCart.tenantId,
      sessionId: newCart.sessionId,
      customerId: newCart.userId,
      items: [],
      createdAt: newCart.createdAt,
      updatedAt: newCart.updatedAt,
    };
  }

  return cart;
}

/**
 * Find existing cart by session or customer
 */
async function findCart(
  tenantId: string,
  sessionId: string,
  customerId?: string | null
): Promise<Cart | null> {
  // If we have a customer ID, try to find their cart first
  if (customerId) {
    const customerCart = await db.query.carts.findFirst({
      where: and(eq(carts.tenantId, tenantId), eq(carts.userId, customerId)),
      with: {
        items: {
          with: {
            product: {
              with: {
                images: {
                  with: { media: true },
                  orderBy: (pi, { asc }) => [asc(pi.position)],
                  limit: 1,
                },
                priceTiers: {
                  orderBy: (pt, { asc }) => [asc(pt.minQuantity)],
                },
              },
            },
            variant: true,
          },
        },
      },
    });

    if (customerCart) {
      return transformCartData(customerCart);
    }
  }

  // Fall back to session-based cart
  const sessionCart = await db.query.carts.findFirst({
    where: and(eq(carts.tenantId, tenantId), eq(carts.sessionId, sessionId)),
    with: {
      items: {
        with: {
          product: {
            with: {
              images: {
                with: { media: true },
                orderBy: (pi, { asc }) => [asc(pi.position)],
                limit: 1,
              },
              priceTiers: {
                orderBy: (pt, { asc }) => [asc(pt.minQuantity)],
              },
            },
          },
          variant: true,
        },
      },
    },
  });

  return sessionCart ? transformCartData(sessionCart) : null;
}

/**
 * Transform raw cart data to typed Cart
 */
function transformCartData(rawCart: {
  id: string;
  tenantId: string;
  sessionId: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  items: Array<{
    id: string;
    productId: string;
    variantId: string | null;
    quantity: number;
    product: {
      id: string;
      name: string;
      slug: string;
      price: string;
      stock: number;
      trackInventory: boolean;
      allowBackorder: boolean;
      status: "draft" | "active" | "archived";
      hasVariants: boolean;
      images: Array<{
        media: {
          url: string;
          altText: string | null;
        };
      }>;
      priceTiers: Array<{
        id: string;
        minQuantity: number;
        maxQuantity: number | null;
        price: string;
      }>;
    };
    variant: {
      id: string;
      displayName: string | null;
      price: string | null;
      stock: number;
      isActive: boolean;
    } | null;
  }>;
}): Cart {
  return {
    id: rawCart.id,
    tenantId: rawCart.tenantId,
    sessionId: rawCart.sessionId,
    customerId: rawCart.userId,
    createdAt: rawCart.createdAt,
    updatedAt: rawCart.updatedAt,
    items: rawCart.items
      .filter((item) => item.product.status === "active") // Only include active products
      .map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          price: item.product.price,
          stock: item.product.stock,
          trackInventory: item.product.trackInventory,
          allowBackorder: item.product.allowBackorder,
          status: item.product.status,
          hasVariants: item.product.hasVariants,
          image: item.product.images[0]?.media
            ? {
                url: item.product.images[0].media.url,
                altText: item.product.images[0].media.altText,
              }
            : null,
          priceTiers: item.product.priceTiers.map((tier) => ({
            id: tier.id,
            minQuantity: tier.minQuantity,
            maxQuantity: tier.maxQuantity,
            price: tier.price,
          })),
        },
        variant: item.variant
          ? {
              id: item.variant.id,
              displayName: item.variant.displayName,
              price: item.variant.price,
              stock: item.variant.stock,
              isActive: item.variant.isActive,
            }
          : null,
      })),
  };
}

/**
 * Get cart item count for a session/customer
 */
export async function getCartItemCount(
  tenantId: string,
  sessionId: string,
  customerId?: string | null
): Promise<number> {
  const cart = await findCart(tenantId, sessionId, customerId);
  if (!cart) return 0;

  return cart.items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Get applicable tier price for a given quantity
 */
function getApplicableTierPrice(
  basePrice: number,
  quantity: number,
  priceTiers: CartPriceTier[]
): number {
  if (priceTiers.length === 0) return basePrice;

  // Sort by minQuantity descending to find the highest applicable tier
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

/**
 * Get cart summary (item count and subtotal)
 */
export async function getCartSummary(
  tenantId: string,
  sessionId: string,
  customerId?: string | null
): Promise<CartSummary> {
  const cart = await findCart(tenantId, sessionId, customerId);
  if (!cart) return { itemCount: 0, subtotal: 0 };

  let itemCount = 0;
  let subtotal = 0;

  for (const item of cart.items) {
    itemCount += item.quantity;
    const basePrice = item.variant?.price
      ? parseFloat(item.variant.price)
      : parseFloat(item.product.price);
    // Apply tier pricing if available
    const effectivePrice = getApplicableTierPrice(
      basePrice,
      item.quantity,
      item.product.priceTiers
    );
    subtotal += effectivePrice * item.quantity;
  }

  return { itemCount, subtotal };
}

// ============================================================================
// MUTATIONS
// ============================================================================

export type AddToCartResult =
  | { success: true; cart: Cart }
  | { success: false; error: string };

/**
 * Add item to cart (or update quantity if already exists)
 */
export async function addToCart(
  tenantId: string,
  sessionId: string,
  productId: string,
  quantity: number,
  variantId?: string | null,
  customerId?: string | null
): Promise<AddToCartResult> {
  // Validate product exists and is active
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.tenantId, tenantId)),
  });

  if (!product) {
    return { success: false, error: "Product not found" };
  }

  if (product.status !== "active") {
    return { success: false, error: "Product is not available" };
  }

  // For variant products, validate variant
  let variant = null;
  if (product.hasVariants) {
    if (!variantId) {
      return { success: false, error: "Please select a variant" };
    }

    variant = await db.query.productVariants.findFirst({
      where: and(
        eq(productVariants.id, variantId),
        eq(productVariants.productId, productId)
      ),
    });

    if (!variant) {
      return { success: false, error: "Variant not found" };
    }

    if (!variant.isActive) {
      return { success: false, error: "Variant is not available" };
    }
  }

  // Check stock availability
  const availableStock = variant ? variant.stock : product.stock;
  const trackInventory = product.trackInventory;
  const allowBackorder = product.allowBackorder;

  if (trackInventory && !allowBackorder && availableStock < quantity) {
    if (availableStock === 0) {
      return { success: false, error: "This item is out of stock" };
    }
    return {
      success: false,
      error: `Only ${availableStock} items available`,
    };
  }

  // Get or create cart
  const cart = await getOrCreateCart(tenantId, sessionId, customerId);

  // Check if item already exists in cart
  const existingItem = cart.items.find(
    (item) =>
      item.productId === productId &&
      (variantId ? item.variantId === variantId : item.variantId === null)
  );

  if (existingItem) {
    // Update quantity
    const newQuantity = existingItem.quantity + quantity;

    // Validate new quantity against stock
    if (trackInventory && !allowBackorder && availableStock < newQuantity) {
      return {
        success: false,
        error: `Cannot add more. Only ${availableStock} items available (${existingItem.quantity} already in cart)`,
      };
    }

    await db
      .update(cartItems)
      .set({
        quantity: newQuantity,
        updatedAt: sql`NOW()`,
      })
      .where(eq(cartItems.id, existingItem.id));
  } else {
    // Add new item
    await db.insert(cartItems).values({
      cartId: cart.id,
      productId,
      variantId: variantId || null,
      quantity,
    });
  }

  // Update cart timestamp
  await db
    .update(carts)
    .set({ updatedAt: sql`NOW()` })
    .where(eq(carts.id, cart.id));

  // Return updated cart
  const updatedCart = await findCart(tenantId, sessionId, customerId);
  return { success: true, cart: updatedCart! };
}

export type UpdateCartItemResult =
  | { success: true; cart: Cart }
  | { success: false; error: string };

/**
 * Update cart item quantity
 */
export async function updateCartItemQuantity(
  tenantId: string,
  sessionId: string,
  cartItemId: string,
  quantity: number,
  customerId?: string | null
): Promise<UpdateCartItemResult> {
  if (quantity < 1) {
    return { success: false, error: "Quantity must be at least 1" };
  }

  // Get cart
  const cart = await findCart(tenantId, sessionId, customerId);
  if (!cart) {
    return { success: false, error: "Cart not found" };
  }

  // Find item
  const item = cart.items.find((i) => i.id === cartItemId);
  if (!item) {
    return { success: false, error: "Item not found in cart" };
  }

  // Check stock
  const availableStock = item.variant ? item.variant.stock : item.product.stock;
  const trackInventory = item.product.trackInventory;
  const allowBackorder = item.product.allowBackorder;

  if (trackInventory && !allowBackorder && availableStock < quantity) {
    return {
      success: false,
      error: `Only ${availableStock} items available`,
    };
  }

  // Update quantity
  await db
    .update(cartItems)
    .set({
      quantity,
      updatedAt: sql`NOW()`,
    })
    .where(eq(cartItems.id, cartItemId));

  // Update cart timestamp
  await db
    .update(carts)
    .set({ updatedAt: sql`NOW()` })
    .where(eq(carts.id, cart.id));

  // Return updated cart
  const updatedCart = await findCart(tenantId, sessionId, customerId);
  return { success: true, cart: updatedCart! };
}

export type RemoveCartItemResult =
  | { success: true; cart: Cart }
  | { success: false; error: string };

/**
 * Remove item from cart
 */
export async function removeFromCart(
  tenantId: string,
  sessionId: string,
  cartItemId: string,
  customerId?: string | null
): Promise<RemoveCartItemResult> {
  // Get cart
  const cart = await findCart(tenantId, sessionId, customerId);
  if (!cart) {
    return { success: false, error: "Cart not found" };
  }

  // Verify item belongs to cart
  const item = cart.items.find((i) => i.id === cartItemId);
  if (!item) {
    return { success: false, error: "Item not found in cart" };
  }

  // Delete item
  await db.delete(cartItems).where(eq(cartItems.id, cartItemId));

  // Update cart timestamp
  await db
    .update(carts)
    .set({ updatedAt: sql`NOW()` })
    .where(eq(carts.id, cart.id));

  // Return updated cart
  const updatedCart = await findCart(tenantId, sessionId, customerId);
  return { success: true, cart: updatedCart! };
}

/**
 * Clear all items from cart
 */
export async function clearCart(
  tenantId: string,
  sessionId: string,
  customerId?: string | null
): Promise<{ success: true } | { success: false; error: string }> {
  const cart = await findCart(tenantId, sessionId, customerId);
  if (!cart) {
    return { success: true }; // No cart to clear
  }

  await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));

  // Update cart timestamp
  await db
    .update(carts)
    .set({ updatedAt: sql`NOW()` })
    .where(eq(carts.id, cart.id));

  return { success: true };
}

/**
 * Merge guest cart into customer cart (after login)
 */
export async function mergeGuestCartToCustomer(
  tenantId: string,
  guestSessionId: string,
  customerId: string
): Promise<void> {
  // Find guest cart
  const guestCart = await db.query.carts.findFirst({
    where: and(
      eq(carts.tenantId, tenantId),
      eq(carts.sessionId, guestSessionId),
      isNull(carts.userId)
    ),
    with: { items: true },
  });

  if (!guestCart || guestCart.items.length === 0) {
    return; // No guest cart to merge
  }

  // Find or create customer cart
  const customerCart = await db.query.carts.findFirst({
    where: and(eq(carts.tenantId, tenantId), eq(carts.userId, customerId)),
    with: { items: true },
  });

  if (!customerCart) {
    // Assign guest cart to customer
    await db
      .update(carts)
      .set({ userId: customerId, updatedAt: sql`NOW()` })
      .where(eq(carts.id, guestCart.id));
    return;
  }

  // Merge items from guest cart to customer cart
  for (const guestItem of guestCart.items) {
    const existingItem = customerCart.items.find(
      (item) =>
        item.productId === guestItem.productId &&
        item.variantId === guestItem.variantId
    );

    if (existingItem) {
      // Add quantities
      await db
        .update(cartItems)
        .set({
          quantity: existingItem.quantity + guestItem.quantity,
          updatedAt: sql`NOW()`,
        })
        .where(eq(cartItems.id, existingItem.id));
    } else {
      // Move item to customer cart
      await db
        .update(cartItems)
        .set({
          cartId: customerCart.id,
          updatedAt: sql`NOW()`,
        })
        .where(eq(cartItems.id, guestItem.id));
    }
  }

  // Delete empty guest cart
  await db.delete(carts).where(eq(carts.id, guestCart.id));

  // Update customer cart timestamp
  await db
    .update(carts)
    .set({ updatedAt: sql`NOW()` })
    .where(eq(carts.id, customerCart.id));
}

/**
 * Validate cart items (check stock, active status) before checkout
 */
export async function validateCartForCheckout(
  tenantId: string,
  sessionId: string,
  customerId?: string | null
): Promise<{
  valid: boolean;
  errors: Array<{ itemId: string; productName: string; error: string }>;
  cart: Cart | null;
}> {
  const cart = await findCart(tenantId, sessionId, customerId);
  if (!cart) {
    return { valid: false, errors: [], cart: null };
  }

  if (cart.items.length === 0) {
    return { valid: false, errors: [], cart };
  }

  const errors: Array<{ itemId: string; productName: string; error: string }> =
    [];

  for (const item of cart.items) {
    // Check product is still active
    if (item.product.status !== "active") {
      errors.push({
        itemId: item.id,
        productName: item.product.name,
        error: "This product is no longer available",
      });
      continue;
    }

    // Check variant is still active
    if (item.variant && !item.variant.isActive) {
      errors.push({
        itemId: item.id,
        productName: `${item.product.name} - ${item.variant.displayName}`,
        error: "This variant is no longer available",
      });
      continue;
    }

    // Check stock
    const availableStock = item.variant
      ? item.variant.stock
      : item.product.stock;
    const trackInventory = item.product.trackInventory;
    const allowBackorder = item.product.allowBackorder;

    if (trackInventory && !allowBackorder) {
      if (availableStock === 0) {
        errors.push({
          itemId: item.id,
          productName: item.variant
            ? `${item.product.name} - ${item.variant.displayName}`
            : item.product.name,
          error: "This item is out of stock",
        });
      } else if (availableStock < item.quantity) {
        errors.push({
          itemId: item.id,
          productName: item.variant
            ? `${item.product.name} - ${item.variant.displayName}`
            : item.product.name,
          error: `Only ${availableStock} items available`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    cart,
  };
}
