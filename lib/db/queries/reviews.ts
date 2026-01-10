"use server";

import { db } from "@/lib/db";
import { reviews } from "@/lib/db/schema";
import { eq, and, desc, avg, count } from "drizzle-orm";

/**
 * Get reviews for a product
 */
export async function getProductReviews(tenantId: string, productId: string) {
  const reviewsList = await db.query.reviews.findMany({
    where: and(
      eq(reviews.tenantId, tenantId),
      eq(reviews.productId, productId)
    ),
    orderBy: [desc(reviews.createdAt)],
    with: {
      images: {
        with: {
          media: true,
        },
        orderBy: (rm, { asc }) => [asc(rm.position)],
      },
    },
  });

  return reviewsList;
}

export type ProductReview = Awaited<
  ReturnType<typeof getProductReviews>
>[number];

/**
 * Get product review statistics (average rating and count)
 */
export async function getProductReviewStats(
  tenantId: string,
  productId: string
) {
  const result = await db
    .select({
      averageRating: avg(reviews.rating),
      totalReviews: count(),
    })
    .from(reviews)
    .where(
      and(eq(reviews.tenantId, tenantId), eq(reviews.productId, productId))
    );

  const stats = result[0];

  return {
    averageRating: stats.averageRating ? parseFloat(stats.averageRating) : null,
    totalReviews: stats.totalReviews || 0,
  };
}
