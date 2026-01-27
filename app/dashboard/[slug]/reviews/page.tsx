import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import {
  getDashboardReviews,
  getReviewStats,
  type ReviewFilters,
  type ReviewSort,
} from "@/lib/db/queries/dashboard-reviews";
import { ReviewsPageClient } from "@/components/dashboard/reviews/reviews-page-client";

interface ReviewsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    rating?: string;
    hasReply?: string;
    isVerified?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
    order?: string;
  }>;
}

export default async function ReviewsPage({
  params,
  searchParams,
}: ReviewsPageProps) {
  const { slug } = await params;
  const search = await searchParams;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  // Parse search params
  const page = parseInt(search.page || "1");
  const limit = Math.min(Math.max(parseInt(search.limit || "25"), 10), 100);

  // Build filters
  const filters: ReviewFilters = {
    search: search.search,
    rating:
      search.rating && search.rating !== "all"
        ? parseInt(search.rating)
        : "all",
    hasReply: (search.hasReply as "yes" | "no" | "all") || "all",
    isVerified: (search.isVerified as "yes" | "no" | "all") || "all",
    dateFrom: search.dateFrom,
    dateTo: search.dateTo,
  };

  // Build sort
  const sort: ReviewSort | undefined = search.sort
    ? {
        field: search.sort as "createdAt" | "rating" | "helpfulVotesUp",
        direction: (search.order || "desc") as "asc" | "desc",
      }
    : undefined;

  // Fetch reviews and stats in parallel
  const [reviewsResult, stats] = await Promise.all([
    getDashboardReviews(store.id, { page, limit, filters, sort }),
    getReviewStats(store.id),
  ]);

  return (
    <ReviewsPageClient
      storeSlug={slug}
      tenantId={store.id}
      reviews={reviewsResult.reviews}
      pagination={reviewsResult.pagination}
      stats={stats}
      searchParams={search}
    />
  );
}
