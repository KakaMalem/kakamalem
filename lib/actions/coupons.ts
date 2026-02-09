"use server";

import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  coupons,
  couponUsages,
  storeCustomers,
  orderDiscounts,
} from "@/lib/db/schema";
import { getUser } from "@/lib/auth/server";
import { hasStoreAccess } from "@/lib/auth/server";
import {
  couponSchema,
  type CouponInput,
  type CouponValidationResult,
  type CartItemForCoupon,
} from "@/lib/validations/coupons";
import {
  getCouponByCode,
  isCouponCodeUnique,
  getCustomerCouponUsageCount,
} from "@/lib/db/queries/coupons";

// =============================================================================
// TYPES
// =============================================================================

type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    field?: string;
  };
};

// =============================================================================
// DASHBOARD CRUD ACTIONS
// =============================================================================

/**
 * Create a new coupon
 */
export async function createCouponAction(
  tenantId: string,
  storeSlug: string,
  input: CouponInput
): Promise<ActionResult<{ id: string }>> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: { message: "Unauthorized" } };
  }

  const access = await hasStoreAccess(tenantId);
  if (!access || access.role === "staff") {
    return { success: false, error: { message: "Unauthorized" } };
  }

  const validation = couponSchema.safeParse(input);
  if (!validation.success) {
    const issue = validation.error.issues[0];
    return {
      success: false,
      error: {
        message: issue.message,
        field: issue.path[0] as string,
      },
    };
  }

  const data = validation.data;

  // Check code uniqueness within tenant
  const isUnique = await isCouponCodeUnique(tenantId, data.code);
  if (!isUnique) {
    return {
      success: false,
      error: {
        message: "A coupon with this code already exists",
        field: "code",
      },
    };
  }

  // Parse values
  const parseOptionalDecimal = (val: string | null | undefined) =>
    val && val !== "" ? val : null;
  const parseOptionalInt = (val: string | null | undefined) =>
    val && val !== "" ? parseInt(val) : null;

  // Insert coupon
  const [newCoupon] = await db
    .insert(coupons)
    .values({
      tenantId,
      code: data.code.toUpperCase(),
      name: data.name,
      description: data.description || null,
      type: data.type,
      value: data.value,
      scope: data.scope,
      minimumOrderAmount: parseOptionalDecimal(data.minimumOrderAmount),
      maximumDiscountAmount: parseOptionalDecimal(data.maximumDiscountAmount),
      usageLimit: parseOptionalInt(data.usageLimit),
      usageLimitPerCustomer: parseOptionalInt(data.usageLimitPerCustomer),
      startsAt: data.startsAt || new Date().toISOString(),
      expiresAt:
        data.expiresAt && data.expiresAt !== "" ? data.expiresAt : null,
      eligibleProducts:
        data.eligibleProducts && data.eligibleProducts.length > 0
          ? data.eligibleProducts
          : null,
      eligibleCategories:
        data.eligibleCategories && data.eligibleCategories.length > 0
          ? data.eligibleCategories
          : null,
      eligibleCustomerGroups:
        data.eligibleCustomerGroups && data.eligibleCustomerGroups.length > 0
          ? data.eligibleCustomerGroups
          : null,
      excludedProducts:
        data.excludedProducts && data.excludedProducts.length > 0
          ? data.excludedProducts
          : null,
      firstOrderOnly: data.firstOrderOnly,
      combinable: data.combinable,
      isActive: data.isActive,
    })
    .returning({ id: coupons.id });

  revalidatePath(`/dashboard/${storeSlug}/coupons`);
  return { success: true, data: { id: newCoupon.id } };
}

/**
 * Update an existing coupon
 */
export async function updateCouponAction(
  tenantId: string,
  storeSlug: string,
  couponId: string,
  input: CouponInput
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: { message: "Unauthorized" } };
  }

  const access = await hasStoreAccess(tenantId);
  if (!access || access.role === "staff") {
    return { success: false, error: { message: "Unauthorized" } };
  }

  const validation = couponSchema.safeParse(input);
  if (!validation.success) {
    const issue = validation.error.issues[0];
    return {
      success: false,
      error: {
        message: issue.message,
        field: issue.path[0] as string,
      },
    };
  }

  const data = validation.data;

  // Check code uniqueness (excluding current coupon)
  const isUnique = await isCouponCodeUnique(tenantId, data.code, couponId);
  if (!isUnique) {
    return {
      success: false,
      error: {
        message: "A coupon with this code already exists",
        field: "code",
      },
    };
  }

  // Parse values
  const parseOptionalDecimal = (val: string | null | undefined) =>
    val && val !== "" ? val : null;
  const parseOptionalInt = (val: string | null | undefined) =>
    val && val !== "" ? parseInt(val) : null;

  await db
    .update(coupons)
    .set({
      code: data.code.toUpperCase(),
      name: data.name,
      description: data.description || null,
      type: data.type,
      value: data.value,
      scope: data.scope,
      minimumOrderAmount: parseOptionalDecimal(data.minimumOrderAmount),
      maximumDiscountAmount: parseOptionalDecimal(data.maximumDiscountAmount),
      usageLimit: parseOptionalInt(data.usageLimit),
      usageLimitPerCustomer: parseOptionalInt(data.usageLimitPerCustomer),
      startsAt: data.startsAt || new Date().toISOString(),
      expiresAt:
        data.expiresAt && data.expiresAt !== "" ? data.expiresAt : null,
      eligibleProducts:
        data.eligibleProducts && data.eligibleProducts.length > 0
          ? data.eligibleProducts
          : null,
      eligibleCategories:
        data.eligibleCategories && data.eligibleCategories.length > 0
          ? data.eligibleCategories
          : null,
      eligibleCustomerGroups:
        data.eligibleCustomerGroups && data.eligibleCustomerGroups.length > 0
          ? data.eligibleCustomerGroups
          : null,
      excludedProducts:
        data.excludedProducts && data.excludedProducts.length > 0
          ? data.excludedProducts
          : null,
      firstOrderOnly: data.firstOrderOnly,
      combinable: data.combinable,
      isActive: data.isActive,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(coupons.id, couponId), eq(coupons.tenantId, tenantId)));

  revalidatePath(`/dashboard/${storeSlug}/coupons`);
  revalidatePath(`/dashboard/${storeSlug}/coupons/${couponId}`);
  return { success: true };
}

/**
 * Delete a coupon (soft delete)
 */
export async function deleteCouponAction(
  tenantId: string,
  storeSlug: string,
  couponId: string
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: { message: "Unauthorized" } };
  }

  const access = await hasStoreAccess(tenantId);
  if (!access || access.role === "staff") {
    return { success: false, error: { message: "Unauthorized" } };
  }

  // Soft delete by setting deletedAt
  await db
    .update(coupons)
    .set({
      deletedAt: new Date().toISOString(),
      isActive: false,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(coupons.id, couponId), eq(coupons.tenantId, tenantId)));

  revalidatePath(`/dashboard/${storeSlug}/coupons`);
  return { success: true };
}

/**
 * Toggle coupon active status
 */
export async function toggleCouponStatusAction(
  tenantId: string,
  storeSlug: string,
  couponId: string,
  isActive: boolean
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: { message: "Unauthorized" } };
  }

  const access = await hasStoreAccess(tenantId);
  if (!access || access.role === "staff") {
    return { success: false, error: { message: "Unauthorized" } };
  }

  await db
    .update(coupons)
    .set({
      isActive,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(coupons.id, couponId), eq(coupons.tenantId, tenantId)));

  revalidatePath(`/dashboard/${storeSlug}/coupons`);
  return { success: true };
}

// =============================================================================
// STOREFRONT VALIDATION ACTIONS
// =============================================================================

/**
 * Validate and calculate discount for a coupon code at checkout
 * This is the main validation action called from storefront
 */
export async function validateCouponAction(
  tenantId: string,
  code: string,
  subtotal: number,
  cartItems: CartItemForCoupon[],
  customerId?: string | null // storeCustomerId if logged in
): Promise<CouponValidationResult> {
  // 1. Find coupon by code (case-insensitive, tenant-scoped)
  const coupon = await getCouponByCode(tenantId, code);

  if (!coupon) {
    return {
      valid: false,
      error: { code: "NOT_FOUND", message: "Invalid promo code" },
    };
  }

  // 2. Check if active
  if (!coupon.isActive) {
    return {
      valid: false,
      error: {
        code: "INACTIVE",
        message: "This promo code is no longer active",
      },
    };
  }

  const now = new Date();

  // 3. Check if started
  if (new Date(coupon.startsAt) > now) {
    return {
      valid: false,
      error: {
        code: "NOT_STARTED",
        message: "This promo code is not yet active",
      },
    };
  }

  // 4. Check if expired
  if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
    return {
      valid: false,
      error: { code: "EXPIRED", message: "This promo code has expired" },
    };
  }

  // 5. Check minimum order amount
  if (coupon.minimumOrderAmount) {
    const minAmount = parseFloat(coupon.minimumOrderAmount);
    if (subtotal < minAmount) {
      return {
        valid: false,
        error: {
          code: "MIN_ORDER_NOT_MET",
          message: `Minimum order of ${minAmount.toLocaleString()} AFN required`,
        },
      };
    }
  }

  // 6. Check total usage limit
  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
    return {
      valid: false,
      error: {
        code: "USAGE_LIMIT_REACHED",
        message: "This promo code has reached its usage limit",
      },
    };
  }

  // 7. Check per-customer usage limit (if customer is logged in)
  if (customerId && coupon.usageLimitPerCustomer) {
    const customerUsageCount = await getCustomerCouponUsageCount(
      coupon.id,
      customerId
    );

    if (customerUsageCount >= coupon.usageLimitPerCustomer) {
      return {
        valid: false,
        error: {
          code: "CUSTOMER_LIMIT_REACHED",
          message: "You have already used this promo code",
        },
      };
    }
  }

  // 8. Check first order only restriction
  if (coupon.firstOrderOnly && customerId) {
    const customer = await db.query.storeCustomers.findFirst({
      where: eq(storeCustomers.id, customerId),
      columns: { totalOrders: true },
    });

    if (customer && customer.totalOrders > 0) {
      return {
        valid: false,
        error: {
          code: "FIRST_ORDER_ONLY",
          message: "This promo code is only valid for first-time customers",
        },
      };
    }
  }

  // 9. Check eligible products/categories and build eligible items list
  let eligibleItems = [...cartItems];

  if (coupon.eligibleProducts && coupon.eligibleProducts.length > 0) {
    eligibleItems = eligibleItems.filter((item) =>
      coupon.eligibleProducts!.includes(item.productId)
    );
  }

  if (coupon.eligibleCategories && coupon.eligibleCategories.length > 0) {
    eligibleItems = eligibleItems.filter(
      (item) =>
        item.categoryId && coupon.eligibleCategories!.includes(item.categoryId)
    );
  }

  if (coupon.excludedProducts && coupon.excludedProducts.length > 0) {
    eligibleItems = eligibleItems.filter(
      (item) => !coupon.excludedProducts!.includes(item.productId)
    );
  }

  // For item-scoped discounts, need at least one eligible item
  if (coupon.scope === "item" && eligibleItems.length === 0) {
    return {
      valid: false,
      error: {
        code: "NO_ELIGIBLE_ITEMS",
        message: "No items in your cart are eligible for this promo code",
      },
    };
  }

  // 10. Calculate discount amount
  const eligibleSubtotal = eligibleItems.reduce(
    (sum, item) => sum + item.lineTotal,
    0
  );
  let discountAmount = 0;

  switch (coupon.type) {
    case "percentage": {
      const percentage = parseFloat(coupon.value);
      discountAmount =
        coupon.scope === "item"
          ? (eligibleSubtotal * percentage) / 100
          : (subtotal * percentage) / 100;
      break;
    }

    case "fixed_amount": {
      discountAmount = parseFloat(coupon.value);
      // Cannot discount more than eligible amount
      const maxDiscount = coupon.scope === "item" ? eligibleSubtotal : subtotal;
      discountAmount = Math.min(discountAmount, maxDiscount);
      break;
    }

    case "free_shipping": {
      // Discount amount will be set to shipping amount at order creation
      // Return 0 here - the actual discount is applied to shipping
      discountAmount = 0;
      break;
    }

    case "buy_x_get_y": {
      // Complex BOGO logic - would need additional parameters
      // For now, return 0 - can be expanded later
      discountAmount = 0;
      break;
    }
  }

  // 11. Apply maximum discount cap
  if (coupon.maximumDiscountAmount) {
    const maxDiscount = parseFloat(coupon.maximumDiscountAmount);
    discountAmount = Math.min(discountAmount, maxDiscount);
  }

  // Round to 2 decimal places
  discountAmount = Math.round(discountAmount * 100) / 100;

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      type: coupon.type,
      value: coupon.value,
      scope: coupon.scope,
      maximumDiscountAmount: coupon.maximumDiscountAmount,
    },
    discountAmount,
  };
}

/**
 * Record coupon usage after successful order
 * Called from createOrderAction within a transaction
 */
export async function recordCouponUsage(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  couponId: string,
  orderId: string,
  customerId: string | null,
  discountAmount: number
): Promise<void> {
  // Record usage
  await tx.insert(couponUsages).values({
    couponId,
    orderId,
    customerId,
    discountAmount: discountAmount.toFixed(2),
  });

  // Increment usage count
  await tx
    .update(coupons)
    .set({
      usageCount: sql`${coupons.usageCount} + 1`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(coupons.id, couponId));
}

/**
 * Create order discount record for audit trail
 * Called from createOrderAction within a transaction
 */
export async function createOrderDiscountRecord(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  orderId: string,
  coupon: {
    id: string;
    code: string;
    name: string;
    type: string;
    value: string;
    scope: string;
  },
  discountAmount: number
): Promise<void> {
  await tx.insert(orderDiscounts).values({
    orderId,
    source: "coupon",
    couponId: coupon.id,
    type: coupon.type as
      | "percentage"
      | "fixed_amount"
      | "free_shipping"
      | "buy_x_get_y",
    scope: coupon.scope as "order" | "item" | "shipping",
    value: coupon.value,
    appliedAmount: discountAmount.toFixed(2),
    title: coupon.name,
    description: `Promo code: ${coupon.code}`,
  });
}
