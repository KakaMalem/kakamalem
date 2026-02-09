import { z } from "zod";

// =============================================================================
// ENUMS (matching database schema)
// =============================================================================

export const discountTypeSchema = z.enum([
  "percentage",
  "fixed_amount",
  "free_shipping",
  "buy_x_get_y",
]);

export const discountScopeSchema = z.enum(["order", "item", "shipping"]);

export type DiscountType = z.infer<typeof discountTypeSchema>;
export type DiscountScope = z.infer<typeof discountScopeSchema>;

// =============================================================================
// COUPON CRUD SCHEMA (Dashboard)
// =============================================================================

export const couponSchema = z
  .object({
    // Basic Info
    code: z
      .string()
      .min(3, "Code must be at least 3 characters")
      .max(50, "Code must be less than 50 characters")
      .regex(
        /^[A-Z0-9_-]+$/i,
        "Code can only contain letters, numbers, hyphens, and underscores"
      )
      .transform((v) => v.toUpperCase()),
    name: z
      .string()
      .min(1, "Name is required")
      .max(100, "Name must be less than 100 characters"),
    description: z.string().max(1000).optional().nullable().or(z.literal("")),

    // Type & Value
    type: discountTypeSchema,
    value: z
      .string()
      .min(1, "Value is required")
      .refine(
        (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0,
        "Value must be a positive number"
      ),
    scope: discountScopeSchema.default("order"),

    // Limits
    minimumOrderAmount: z
      .string()
      .refine(
        (v) => v === "" || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0),
        "Must be a valid positive number"
      )
      .optional()
      .nullable()
      .or(z.literal("")),
    maximumDiscountAmount: z
      .string()
      .refine(
        (v) => v === "" || (!isNaN(parseFloat(v)) && parseFloat(v) > 0),
        "Must be a valid positive number"
      )
      .optional()
      .nullable()
      .or(z.literal("")),

    // Usage Limits
    usageLimit: z
      .string()
      .refine(
        (v) => v === "" || (!isNaN(parseInt(v)) && parseInt(v) > 0),
        "Must be a positive integer"
      )
      .optional()
      .nullable()
      .or(z.literal("")),
    usageLimitPerCustomer: z
      .string()
      .refine(
        (v) => v === "" || (!isNaN(parseInt(v)) && parseInt(v) > 0),
        "Must be a positive integer"
      )
      .optional()
      .nullable()
      .or(z.literal("")),

    // Validity
    startsAt: z.string().optional().nullable(),
    expiresAt: z.string().optional().nullable().or(z.literal("")),

    // Restrictions
    eligibleProducts: z.array(z.string().uuid()).optional().nullable(),
    eligibleCategories: z.array(z.string().uuid()).optional().nullable(),
    eligibleCustomerGroups: z.array(z.string().uuid()).optional().nullable(),
    excludedProducts: z.array(z.string().uuid()).optional().nullable(),
    firstOrderOnly: z.boolean().default(false),

    // Combination Rules
    combinable: z.boolean().default(false),

    // Status
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      // Percentage must be 0-100
      if (data.type === "percentage") {
        const value = parseFloat(data.value);
        return value > 0 && value <= 100;
      }
      return true;
    },
    {
      message: "Percentage must be between 1 and 100",
      path: ["value"],
    }
  )
  .refine(
    (data) => {
      // expiresAt must be after startsAt if both provided
      if (data.startsAt && data.expiresAt && data.expiresAt !== "") {
        return new Date(data.expiresAt) > new Date(data.startsAt);
      }
      return true;
    },
    {
      message: "Expiry date must be after start date",
      path: ["expiresAt"],
    }
  );

export type CouponInput = z.infer<typeof couponSchema>;

// =============================================================================
// APPLY COUPON SCHEMA (Storefront)
// =============================================================================

export const applyCouponSchema = z.object({
  code: z
    .string()
    .min(1, "Promo code is required")
    .max(50, "Invalid promo code")
    .transform((v) => v.toUpperCase().trim()),
});

export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;

// =============================================================================
// CART ITEM FOR COUPON VALIDATION
// =============================================================================

export type CartItemForCoupon = {
  productId: string;
  categoryId: string | null;
  quantity: number;
  lineTotal: number;
};

// =============================================================================
// COUPON VALIDATION RESULT
// =============================================================================

export type CouponValidationError = {
  code:
    | "NOT_FOUND"
    | "INACTIVE"
    | "EXPIRED"
    | "NOT_STARTED"
    | "MIN_ORDER_NOT_MET"
    | "USAGE_LIMIT_REACHED"
    | "CUSTOMER_LIMIT_REACHED"
    | "NO_ELIGIBLE_ITEMS"
    | "FIRST_ORDER_ONLY"
    | "ALREADY_APPLIED";
  message: string;
};

export type ValidatedCoupon = {
  id: string;
  code: string;
  name: string;
  type: DiscountType;
  value: string;
  scope: DiscountScope;
  maximumDiscountAmount: string | null;
};

export type CouponValidationResult =
  | {
      valid: true;
      coupon: ValidatedCoupon;
      discountAmount: number;
    }
  | {
      valid: false;
      error: CouponValidationError;
    };

// =============================================================================
// APPLIED COUPON TYPE (for checkout store)
// =============================================================================

export type AppliedCoupon = {
  id: string;
  code: string;
  name: string;
  type: DiscountType;
  discountAmount: number;
};
