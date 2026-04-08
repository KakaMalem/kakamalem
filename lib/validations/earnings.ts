import { z } from "zod";

// =============================================================================
// EARNINGS & PAYOUT VALIDATION SCHEMAS
// =============================================================================

/**
 * Payout method types
 */
export const payoutMethodTypeSchema = z.enum([
  "bank_transfer",
  "mobile_money",
  "cash",
  "check",
  "crypto",
]);

export type PayoutMethodTypeInput = z.infer<typeof payoutMethodTypeSchema>;

/**
 * Base schema for all payout methods
 */
const basePayoutMethodSchema = z.object({
  label: z.string().max(100).optional(),
  isDefault: z.boolean().default(false),
});

/**
 * Bank transfer payout method
 */
export const bankTransferMethodSchema = basePayoutMethodSchema.extend({
  type: z.literal("bank_transfer"),
  bankName: z.string().min(1, "Bank name is required").max(255),
  accountNumber: z.string().min(1, "Account number is required").max(100),
  accountName: z.string().min(1, "Account holder name is required").max(255),
  bankCode: z.string().max(50).optional(),
  routingNumber: z.string().max(50).optional(),
  swiftCode: z.string().max(20).optional(),
  iban: z.string().max(50).optional(),
});

export type BankTransferMethodInput = z.infer<typeof bankTransferMethodSchema>;

/**
 * Mobile money payout method
 */
export const mobileMoneyMethodSchema = basePayoutMethodSchema.extend({
  type: z.literal("mobile_money"),
  mobileNumber: z.string().min(1, "Mobile number is required").max(50),
  mobileProvider: z.string().min(1, "Provider is required").max(100),
  accountName: z.string().max(255).optional(),
});

export type MobileMoneyMethodInput = z.infer<typeof mobileMoneyMethodSchema>;

/**
 * Cash pickup payout method
 */
export const cashMethodSchema = basePayoutMethodSchema.extend({
  type: z.literal("cash"),
  additionalInfo: z.record(z.string(), z.string()).optional(),
});

export type CashMethodInput = z.infer<typeof cashMethodSchema>;

/**
 * Crypto (USDT) payout method
 */
export const cryptoMethodSchema = basePayoutMethodSchema.extend({
  type: z.literal("crypto"),
  walletAddress: z
    .string()
    .min(1, "Wallet address is required")
    .max(100)
    .refine((val) => {
      // TRC20: starts with T, 34 chars, base58
      if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(val)) return true;
      // ERC20/BEP20: starts with 0x, 42 hex chars
      if (/^0x[0-9a-fA-F]{40}$/.test(val)) return true;
      return false;
    }, "Invalid wallet address. TRC20 addresses start with T (34 chars), ERC20/BEP20 start with 0x (42 chars)"),
  network: z.enum(["trc20", "erc20", "bep20"]),
});

export type CryptoMethodInput = z.infer<typeof cryptoMethodSchema>;

/**
 * Union schema for all payout methods
 */
export const payoutMethodSchema = z.union([
  bankTransferMethodSchema,
  mobileMoneyMethodSchema,
  cashMethodSchema,
  cryptoMethodSchema,
]);

export type PayoutMethodInput = z.infer<typeof payoutMethodSchema>;

/**
 * Schema for requesting a payout
 */
export const requestPayoutSchema = z.object({
  amount: z
    .number()
    .positive("Amount must be greater than 0")
    .max(1000000, "Amount exceeds maximum allowed"),
  payoutMethodId: z.string().uuid("Invalid payout method"),
  notes: z.string().max(500).optional(),
});

export type RequestPayoutInput = z.infer<typeof requestPayoutSchema>;

/**
 * Schema for updating payout settings (auto-payout, thresholds)
 */
export const payoutSettingsSchema = z.object({
  autoPayout: z.boolean().default(false),
  autoPayoutThreshold: z
    .number()
    .min(0, "Threshold must be 0 or greater")
    .max(1000000, "Threshold exceeds maximum")
    .optional(),
  payoutHoldDays: z
    .number()
    .int()
    .min(0, "Hold days must be 0 or greater")
    .max(30, "Hold days cannot exceed 30")
    .optional(),
});

export type PayoutSettingsInput = z.infer<typeof payoutSettingsSchema>;

/**
 * Schema for admin payout processing
 */
export const processPayoutSchema = z.object({
  payoutId: z.string().uuid("Invalid payout ID"),
  status: z.enum(["processing", "completed", "failed", "cancelled"]),
  externalReference: z.string().max(255).optional(),
  failureReason: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
});

export type ProcessPayoutInput = z.infer<typeof processPayoutSchema>;
