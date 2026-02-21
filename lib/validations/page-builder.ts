import { z } from "zod";

// Puck content item schema
const puckContentItemSchema = z.object({
  type: z.string().min(1),
  props: z
    .record(z.string(), z.unknown())
    .and(z.object({ id: z.string().min(1) })),
});

// Full Puck data schema
export const puckDataSchema = z.object({
  root: z.object({
    props: z.record(z.string(), z.unknown()).optional(),
  }),
  content: z.array(puckContentItemSchema),
  zones: z.record(z.string(), z.array(puckContentItemSchema)).optional(),
});

export type PuckDataInput = z.infer<typeof puckDataSchema>;

// Page type validation — built-in types + custom
export const pageTypeSchema = z.enum([
  "homepage",
  "about",
  "contact",
  "faq",
  "custom",
]);

export type PageType = z.infer<typeof pageTypeSchema>;

// Page slug: lowercase, alphanumeric + hyphens, no leading/trailing hyphens
export const pageSlugSchema = z
  .string()
  .min(1, "Slug is required")
  .max(100, "Slug too long")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must be lowercase letters, numbers, and hyphens only"
  )
  .refine((s) => s !== "page", "Reserved slug: 'page'");

// Create page input
export const createPageSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  slug: pageSlugSchema,
  pageType: pageTypeSchema,
});

export type CreatePageInput = z.infer<typeof createPageSchema>;

// Update page meta (title/slug only — not layout data)
export const updatePageMetaSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  slug: pageSlugSchema.optional(),
});

export type UpdatePageMetaInput = z.infer<typeof updatePageMetaSchema>;
