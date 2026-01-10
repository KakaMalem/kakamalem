import { z } from "zod";
import { slugify } from "@/lib/utils/slug";

// Category validation schema
export const categorySchema = z.object({
  name: z
    .string()
    .min(1, "Category name is required")
    .min(2, "Category name must be at least 2 characters")
    .max(255, "Category name must be less than 255 characters"),
  // Note: slug is auto-generated on the backend from the name field
  // It's kept optional here for backward compatibility but will be ignored
  slug: z.string().optional(),
  description: z.string().optional().or(z.literal("")),
  imageId: z.string().uuid().optional().or(z.literal("")),
  displayOrder: z
    .number()
    .int()
    .min(0, "Display order must be a positive number")
    .default(0),
});

export type CategoryInput = z.infer<typeof categorySchema>;

// Helper function to generate slug from name (supports Unicode)
export function generateCategorySlug(name: string): string {
  return slugify(name);
}

// Reorder schema for drag-and-drop
export const reorderCategoriesSchema = z.object({
  categoryIds: z
    .array(z.string().uuid())
    .min(1, "At least one category is required"),
});

export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
