import { z } from "zod";

export const linkTargetTypes = ["store", "product", "category", "url"] as const;
export type LinkTargetType = (typeof linkTargetTypes)[number];

const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const linkSchema = z
  .object({
    name: optionalTrimmed(255),
    targetType: z.enum(linkTargetTypes),
    productId: z.string().uuid().optional().nullable(),
    categoryId: z.string().uuid().optional().nullable(),
    // Absolute URL or store-relative path (for targetType "url")
    targetUrl: optionalTrimmed(2000),

    // Optional custom short code; blank = auto-generate
    customCode: optionalTrimmed(50),

    utmSource: optionalTrimmed(255),
    utmMedium: optionalTrimmed(255),
    utmCampaign: optionalTrimmed(255),
    utmContent: optionalTrimmed(255),
    utmTerm: optionalTrimmed(255),

    // ISO date string; blank/undefined = never expires
    expiresAt: z.string().datetime().optional().nullable().or(z.literal("")),

    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.targetType === "product" && !data.productId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pick a product for this link",
        path: ["productId"],
      });
    }
    if (data.targetType === "category" && !data.categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pick a category for this link",
        path: ["categoryId"],
      });
    }
    if (data.targetType === "url" && !data.targetUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a destination URL or path",
        path: ["targetUrl"],
      });
    }
  });

export type LinkInput = z.infer<typeof linkSchema>;
