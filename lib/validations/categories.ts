import { z } from "zod";

// Slug validation pattern: lowercase letters, numbers, and hyphens only
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Category validation schema
export const categorySchema = z.object({
  name: z
    .string()
    .min(1, "Category name is required")
    .min(2, "Category name must be at least 2 characters")
    .max(255, "Category name must be less than 255 characters"),
  slug: z
    .string()
    .min(1, "Category URL is required")
    .min(2, "Category URL must be at least 2 characters")
    .max(255, "Category URL must be less than 255 characters")
    .regex(
      slugRegex,
      "Category URL can only contain lowercase letters, numbers, and hyphens"
    ),
  description: z.string().optional().or(z.literal("")),
  imageId: z.string().uuid().optional().or(z.literal("")),
  displayOrder: z
    .number()
    .int()
    .min(0, "Display order must be a positive number")
    .default(0),
});

export type CategoryInput = z.infer<typeof categorySchema>;

// Helper function to generate slug from name
export function generateCategorySlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

// Reorder schema for drag-and-drop
export const reorderCategoriesSchema = z.object({
  categoryIds: z
    .array(z.string().uuid())
    .min(1, "At least one category is required"),
});

export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
