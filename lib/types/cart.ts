/**
 * Cart Types
 *
 * Centralized type definitions for the cart system.
 * Used across store, mutations, actions, and components.
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export type CartPriceTier = {
  id: string;
  minQuantity: number;
  maxQuantity: number | null;
  price: string;
};

export type CartItemProduct = {
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

export type CartItemVariant = {
  id: string;
  displayName: string | null;
  price: string | null;
  stock: number;
  isActive: boolean;
  image: {
    url: string;
    altText: string | null;
  } | null;
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
  sessionId: string | null;
  customerId: string | null;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
};

// ============================================================================
// COMPUTED TYPES
// ============================================================================

export type CartSummary = {
  itemCount: number;
  subtotal: number;
};

export type CartTotals = {
  itemCount: number;
  subtotal: number;
  savings: number;
};

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export type CartValidationError = {
  itemId: string;
  productId: string;
  variantId: string | null;
  type:
    | "out_of_stock"
    | "insufficient_stock"
    | "product_unavailable"
    | "variant_unavailable";
  message: string;
  availableStock?: number;
  requestedQuantity?: number;
};

export type CartValidationResult = {
  valid: boolean;
  errors: CartValidationError[];
};

// ============================================================================
// ACTION RESULT TYPES
// ============================================================================

export type CartActionSuccess<T = Cart> = {
  success: true;
  cart: T;
};

export type CartActionError = {
  success: false;
  error: string;
  code?: CartErrorCode;
};

export type CartActionResult<T = Cart> = CartActionSuccess<T> | CartActionError;

// ============================================================================
// ERROR CODES
// ============================================================================

export type CartErrorCode =
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_UNAVAILABLE"
  | "VARIANT_NOT_FOUND"
  | "VARIANT_UNAVAILABLE"
  | "INSUFFICIENT_STOCK"
  | "OUT_OF_STOCK"
  | "INVALID_QUANTITY"
  | "CART_NOT_FOUND"
  | "ITEM_NOT_FOUND"
  | "UNAUTHORIZED"
  | "UNKNOWN_ERROR";

// ============================================================================
// MUTATION VARIABLE TYPES
// ============================================================================

export type AddToCartVariables = {
  tenantId: string;
  storeSlug: string;
  productId: string;
  quantity: number;
  variantId?: string | null;
  // For optimistic updates - product data to display immediately
  optimisticProduct?: CartItemProduct;
  optimisticVariant?: CartItemVariant;
};

export type UpdateCartItemVariables = {
  tenantId: string;
  storeSlug: string;
  itemId: string;
  quantity: number;
};

export type RemoveCartItemVariables = {
  tenantId: string;
  storeSlug: string;
  itemId: string;
};

export type ClearCartVariables = {
  tenantId: string;
  storeSlug: string;
};

// ============================================================================
// STORE STATE TYPES
// ============================================================================

export type CartState = {
  items: CartItem[];
  tenantId: string | null;
  storeSlug: string | null;
  isHydrated: boolean;
  lastSyncedAt: number | null;
};

export type CartSnapshot = {
  items: CartItem[];
  tenantId: string | null;
  storeSlug: string | null;
  timestamp: number;
};

// ============================================================================
// HELPER TYPE GUARDS
// ============================================================================

export function isCartActionSuccess<T>(
  result: CartActionResult<T>
): result is CartActionSuccess<T> {
  return result.success === true;
}

export function isCartActionError(
  result: CartActionResult
): result is CartActionError {
  return result.success === false;
}
