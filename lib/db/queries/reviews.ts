"use server";

import { db } from "@/lib/db";
import { reviews, reviewVotes } from "@/lib/db/schema";
import { eq, and, desc, asc, avg, count, sql } from "drizzle-orm";
import type { ReviewSortOption } from "@/lib/validations/reviews";

/**
 * Get reviews for a product with sorting and filtering options
 */
export async function getProductReviews(
  tenantId: string,
  productId: string,
  sortBy: ReviewSortOption = "newest",
  ratingFilter?: number
) {
  // Build order by clause based on sort option
  const orderByClause = (() => {
    switch (sortBy) {
      case "newest":
        return [desc(reviews.createdAt)];
      case "oldest":
        return [asc(reviews.createdAt)];
      case "highest":
        return [desc(reviews.rating), desc(reviews.createdAt)];
      case "lowest":
        return [asc(reviews.rating), desc(reviews.createdAt)];
      case "most_helpful":
        return [desc(reviews.helpfulVotesUp), desc(reviews.createdAt)];
      default:
        return [desc(reviews.createdAt)];
    }
  })();

  // Build where conditions
  const whereConditions = [
    eq(reviews.tenantId, tenantId),
    eq(reviews.productId, productId),
  ];

  // Add rating filter if specified
  if (ratingFilter && ratingFilter >= 1 && ratingFilter <= 5) {
    whereConditions.push(eq(reviews.rating, ratingFilter));
  }

  const reviewsList = await db.query.reviews.findMany({
    where: and(...whereConditions),
    orderBy: orderByClause,
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
 * Get product review statistics (average rating, count, and distribution)
 */
export async function getProductReviewStats(
  tenantId: string,
  productId: string
) {
  // Get basic stats
  const basicStats = await db
    .select({
      averageRating: avg(reviews.rating),
      totalReviews: count(),
    })
    .from(reviews)
    .where(
      and(eq(reviews.tenantId, tenantId), eq(reviews.productId, productId))
    );

  // Get rating distribution (count per star level)
  const distribution = await db
    .select({
      rating: reviews.rating,
      count: count(),
    })
    .from(reviews)
    .where(
      and(eq(reviews.tenantId, tenantId), eq(reviews.productId, productId))
    )
    .groupBy(reviews.rating);

  // Build distribution object
  const ratingDistribution: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  for (const row of distribution) {
    ratingDistribution[row.rating] = row.count;
  }

  const stats = basicStats[0];

  return {
    averageRating: stats.averageRating ? parseFloat(stats.averageRating) : null,
    totalReviews: stats.totalReviews || 0,
    ratingDistribution,
  };
}

export type ProductReviewStats = Awaited<
  ReturnType<typeof getProductReviewStats>
>;

/**
 * Get user's votes on multiple reviews
 */
export async function getUserReviewVotes(userId: string, reviewIds: string[]) {
  if (reviewIds.length === 0) return {};

  const votes = await db.query.reviewVotes.findMany({
    where: and(
      eq(reviewVotes.userId, userId),
      sql`${reviewVotes.reviewId} IN (${sql.join(
        reviewIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    ),
  });

  // Create a map of reviewId -> isHelpful
  const voteMap: Record<string, boolean> = {};
  for (const vote of votes) {
    voteMap[vote.reviewId] = vote.isHelpful;
  }

  return voteMap;
}

/**
 * Get all reviews with media for a product (for UGC gallery)
 */
export async function getProductReviewMedia(
  tenantId: string,
  productId: string
) {
  const reviewsWithMedia = await db.query.reviews.findMany({
    where: and(
      eq(reviews.tenantId, tenantId),
      eq(reviews.productId, productId)
    ),
    with: {
      images: {
        with: {
          media: true,
        },
        orderBy: (rm, { asc }) => [asc(rm.position)],
      },
    },
  });

  // Flatten to get all media with review context
  const allMedia = reviewsWithMedia.flatMap((review) =>
    review.images.map((img) => ({
      ...img.media,
      reviewId: review.id,
      reviewRating: review.rating,
      reviewerName: review.customerSnapshot.name,
    }))
  );

  return allMedia;
}

export type ReviewMediaItem = Awaited<
  ReturnType<typeof getProductReviewMedia>
>[number];

/**
 * Get a user's existing review for a product (if they have one)
 */
export async function getUserProductReview(
  tenantId: string,
  productId: string,
  userId: string
) {
  const review = await db.query.reviews.findFirst({
    where: and(
      eq(reviews.tenantId, tenantId),
      eq(reviews.productId, productId),
      eq(reviews.userId, userId)
    ),
    with: {
      images: {
        with: {
          media: true,
        },
        orderBy: (rm, { asc }) => [asc(rm.position)],
      },
    },
  });

  return review;
}

export type UserProductReview = Awaited<
  ReturnType<typeof getUserProductReview>
>;
