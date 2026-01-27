"use server";

import { db } from "@/lib/db";
import { reviews } from "@/lib/db/schema";
import { eq, and, desc, asc, count, sql, gte, lte } from "drizzle-orm";

export type ReviewFilters = {
  search?: string;
  rating?: number | "all";
  hasReply?: "yes" | "no" | "all";
  isVerified?: "yes" | "no" | "all";
  dateFrom?: string;
  dateTo?: string;
};

export type ReviewSort = {
  field: "createdAt" | "rating" | "helpfulVotesUp";
  direction: "asc" | "desc";
};

/**
 * Get reviews for dashboard with filters, pagination, and sorting
 */
export async function getDashboardReviews(
  tenantId: string,
  options: {
    page?: number;
    limit?: number;
    filters?: ReviewFilters;
    sort?: ReviewSort;
  } = {}
) {
  const { page = 1, limit = 25, filters = {}, sort } = options;
  const offset = (page - 1) * limit;

  // Build conditions
  const conditions = [eq(reviews.tenantId, tenantId)];

  // Search in title, comment, or customer name
  if (filters.search) {
    conditions.push(
      sql`(
        ${reviews.title} ILIKE ${`%${filters.search}%`} OR
        ${reviews.comment} ILIKE ${`%${filters.search}%`} OR
        ${reviews.customerSnapshot}->>'name' ILIKE ${`%${filters.search}%`}
      )`
    );
  }

  // Rating filter
  if (filters.rating && filters.rating !== "all") {
    conditions.push(eq(reviews.rating, filters.rating));
  }

  // Has reply filter
  if (filters.hasReply === "yes") {
    conditions.push(sql`${reviews.replyContent} IS NOT NULL`);
  } else if (filters.hasReply === "no") {
    conditions.push(sql`${reviews.replyContent} IS NULL`);
  }

  // Verified purchase filter
  if (filters.isVerified === "yes") {
    conditions.push(eq(reviews.isVerifiedPurchase, true));
  } else if (filters.isVerified === "no") {
    conditions.push(eq(reviews.isVerifiedPurchase, false));
  }

  // Date range filter
  if (filters.dateFrom) {
    conditions.push(gte(reviews.createdAt, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(reviews.createdAt, filters.dateTo));
  }

  // Build order by
  let orderBy;
  if (sort) {
    const direction = sort.direction === "asc" ? asc : desc;
    switch (sort.field) {
      case "rating":
        orderBy = [direction(reviews.rating), desc(reviews.createdAt)];
        break;
      case "helpfulVotesUp":
        orderBy = [direction(reviews.helpfulVotesUp), desc(reviews.createdAt)];
        break;
      default:
        orderBy = [direction(reviews.createdAt)];
    }
  } else {
    orderBy = [desc(reviews.createdAt)];
  }

  // Fetch reviews with product info
  const reviewsList = await db.query.reviews.findMany({
    where: and(...conditions),
    orderBy,
    limit,
    offset,
    with: {
      product: {
        columns: {
          id: true,
          name: true,
          slug: true,
        },
      },
      images: {
        with: {
          media: true,
        },
        orderBy: (rm, { asc }) => [asc(rm.position)],
      },
    },
  });

  // Get total count
  const [{ total }] = await db
    .select({ total: count() })
    .from(reviews)
    .where(and(...conditions));

  return {
    reviews: reviewsList,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export type DashboardReview = Awaited<
  ReturnType<typeof getDashboardReviews>
>["reviews"][number];

/**
 * Get review statistics for dashboard
 */
export async function getReviewStats(tenantId: string) {
  const stats = await db
    .select({
      totalReviews: count(),
      avgRating: sql<number>`ROUND(AVG(${reviews.rating}), 1)`,
      totalWithReply: sql<number>`COUNT(*) FILTER (WHERE ${reviews.replyContent} IS NOT NULL)`,
      totalVerified: sql<number>`COUNT(*) FILTER (WHERE ${reviews.isVerifiedPurchase} = true)`,
      // Rating breakdown
      rating5: sql<number>`COUNT(*) FILTER (WHERE ${reviews.rating} = 5)`,
      rating4: sql<number>`COUNT(*) FILTER (WHERE ${reviews.rating} = 4)`,
      rating3: sql<number>`COUNT(*) FILTER (WHERE ${reviews.rating} = 3)`,
      rating2: sql<number>`COUNT(*) FILTER (WHERE ${reviews.rating} = 2)`,
      rating1: sql<number>`COUNT(*) FILTER (WHERE ${reviews.rating} = 1)`,
      // Recent counts (last 7 days)
      recentReviews: sql<number>`COUNT(*) FILTER (WHERE ${reviews.createdAt} > NOW() - INTERVAL '7 days')`,
      pendingReplies: sql<number>`COUNT(*) FILTER (WHERE ${reviews.replyContent} IS NULL)`,
    })
    .from(reviews)
    .where(eq(reviews.tenantId, tenantId));

  return stats[0];
}

export type ReviewStats = Awaited<ReturnType<typeof getReviewStats>>;

/**
 * Get single review by ID for reply
 */
export async function getReviewById(tenantId: string, reviewId: string) {
  return db.query.reviews.findFirst({
    where: and(eq(reviews.id, reviewId), eq(reviews.tenantId, tenantId)),
    with: {
      product: {
        columns: {
          id: true,
          name: true,
          slug: true,
        },
      },
      images: {
        with: {
          media: true,
        },
        orderBy: (rm, { asc }) => [asc(rm.position)],
      },
    },
  });
}
