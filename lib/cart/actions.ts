"use server";

import { getOrCreateCartSessionInAction } from "./session";
import { getUser } from "@/lib/supabase/auth";
import {
  addToCart as dbAddToCart,
  updateCartItemQuantity as dbUpdateCartItemQuantity,
  removeFromCart as dbRemoveFromCart,
  clearCart as dbClearCart,
  getCartSummary as dbGetCartSummary,
  validateCartForCheckout as dbValidateCartForCheckout,
  mergeGuestCartToCustomer,
  getOrCreateCart,
} from "@/lib/db/queries/carts";
import { revalidatePath } from "next/cache";

// ============================================================================
// TYPES (defined here to avoid server/client bundling issues)
// ============================================================================

export type CartItemProduct = {
  id: string;
  name: string;
  slug: string;
  price: string;
  stock: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  isActive: boolean;
  hasVariants: boolean;
  image: {
    url: string;
    altText: string | null;
  } | null;
};

export type CartItemVariant = {
  id: string;
  displayName: string | null;
  price: string | null;
  stock: number;
  isActive: boolean;
} | null;

export type CartItem = {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  product: CartItemProduct;
  variant: CartItemVariant;
};

export type Cart = {
  id: string;
  tenantId: string;
  sessionId: string;
  customerId: string | null;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
};

export type CartSummary = {
  itemCount: number;
  subtotal: number;
};

export type AddToCartResult =
  | { success: true; cart: Cart }
  | { success: false; error: string };

export type UpdateCartItemResult =
  | { success: true; cart: Cart }
  | { success: false; error: string };

export type RemoveCartItemResult =
  | { success: true; cart: Cart }
  | { success: false; error: string };

// ============================================================================
// CART ACTIONS
// ============================================================================

/**
 * Add item to cart
 */
export async function addToCartAction(
  tenantId: string,
  storeSlug: string,
  productId: string,
  quantity: number,
  variantId?: string | null
): Promise<AddToCartResult> {
  const sessionId = await getOrCreateCartSessionInAction();
  const user = await getUser();

  const result = await dbAddToCart(
    tenantId,
    sessionId,
    productId,
    quantity,
    variantId,
    user?.id
  );

  if (result.success) {
    revalidatePath(`/store/${storeSlug}`);
  }

  return result;
}

/**
 * Update cart item quantity
 */
export async function updateCartItemQuantityAction(
  tenantId: string,
  storeSlug: string,
  cartItemId: string,
  quantity: number
): Promise<UpdateCartItemResult> {
  const sessionId = await getOrCreateCartSessionInAction();
  const user = await getUser();

  const result = await dbUpdateCartItemQuantity(
    tenantId,
    sessionId,
    cartItemId,
    quantity,
    user?.id
  );

  if (result.success) {
    revalidatePath(`/store/${storeSlug}`);
  }

  return result;
}

/**
 * Remove item from cart
 */
export async function removeFromCartAction(
  tenantId: string,
  storeSlug: string,
  cartItemId: string
): Promise<RemoveCartItemResult> {
  const sessionId = await getOrCreateCartSessionInAction();
  const user = await getUser();

  const result = await dbRemoveFromCart(tenantId, sessionId, cartItemId, user?.id);

  if (result.success) {
    revalidatePath(`/store/${storeSlug}`);
  }

  return result;
}

/**
 * Clear all items from cart
 */
export async function clearCartAction(
  tenantId: string,
  storeSlug: string
): Promise<{ success: boolean; error?: string }> {
  const sessionId = await getOrCreateCartSessionInAction();
  const user = await getUser();

  const result = await dbClearCart(tenantId, sessionId, user?.id);

  if (result.success) {
    revalidatePath(`/store/${storeSlug}`);
  }

  return result;
}

/**
 * Get cart summary (item count and subtotal)
 */
export async function getCartSummaryAction(tenantId: string): Promise<CartSummary> {
  const sessionId = await getOrCreateCartSessionInAction();
  const user = await getUser();

  return dbGetCartSummary(tenantId, sessionId, user?.id);
}

/**
 * Validate cart before checkout
 */
export async function validateCartAction(tenantId: string) {
  const sessionId = await getOrCreateCartSessionInAction();
  const user = await getUser();

  return dbValidateCartForCheckout(tenantId, sessionId, user?.id);
}

/**
 * Merge guest cart to customer after login
 */
export async function mergeCartOnLoginAction(tenantId: string): Promise<void> {
  const sessionId = await getOrCreateCartSessionInAction();
  const user = await getUser();

  if (user?.id) {
    await mergeGuestCartToCustomer(tenantId, sessionId, user.id);
  }
}

/**
 * Get current cart (used for refetching on sync failure)
 */
export async function getCartAction(
  tenantId: string
): Promise<{ success: true; cart: Cart } | { success: false; error: string }> {
  try {
    const sessionId = await getOrCreateCartSessionInAction();
    const user = await getUser();

    const cart = await getOrCreateCart(tenantId, sessionId, user?.id);
    return { success: true, cart };
  } catch {
    return { success: false, error: "Failed to fetch cart" };
  }
}
