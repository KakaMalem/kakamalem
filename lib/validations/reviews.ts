import { z } from "zod";

// Review submission validation schema
export const reviewSchema = z.object({
  rating: z
    .number()
    .int()
    .min(1, "Rating must be at least 1 star")
    .max(5, "Rating cannot exceed 5 stars"),
  title: z
    .string()
    .max(255, "Title must be less than 255 characters")
    .optional()
    .or(z.literal("")),
  comment: z
    .string()
    .max(5000, "Review must be less than 5000 characters")
    .optional()
    .or(z.literal("")),
  // Media IDs for uploaded images (max 5)
  mediaIds: z
    .array(z.string().uuid())
    .max(5, "You can upload up to 5 images")
    .default([]),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

// Review vote validation
export const reviewVoteSchema = z.object({
  reviewId: z.string().uuid("Invalid review ID"),
  isHelpful: z.boolean(),
});

export type ReviewVoteInput = z.infer<typeof reviewVoteSchema>;

// Owner reply validation
export const reviewReplySchema = z.object({
  reviewId: z.string().uuid("Invalid review ID"),
  replyContent: z
    .string()
    .min(1, "Reply cannot be empty")
    .max(2000, "Reply must be less than 2000 characters"),
});

export type ReviewReplyInput = z.infer<typeof reviewReplySchema>;

// Review sorting options
export const reviewSortOptions = [
  "newest",
  "oldest",
  "highest",
  "lowest",
  "most_helpful",
] as const;

export type ReviewSortOption = (typeof reviewSortOptions)[number];

export const reviewSortSchema = z.enum(reviewSortOptions).default("newest");
