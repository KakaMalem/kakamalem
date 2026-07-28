import { Suspense } from "react";
import { MessageSquare, Star, Sparkles, Filter } from "lucide-react";
import {
  getProductReviews,
  getProductReviewStats,
  getUserReviewVotes,
  getProductReviewMedia,
  getUserProductReview,
} from "@/lib/db/queries/reviews";
import { canReviewProductAction } from "@/lib/actions/reviews";
import { getUser } from "@/lib/auth/server";
import {
  ReviewInlineForm,
  ReviewCard,
  ReviewRatingBreakdown,
  ReviewSortSelect,
  ReviewPhotoGallery,
  UserExistingReview,
} from "./reviews";
import type { ReviewSortOption } from "@/lib/validations/reviews";

interface ProductReviewsProps {
  tenantId: string;
  productId: string;
  productSlug: string;
  storeSlug: string;
  productName?: string;
  sortBy?: ReviewSortOption;
  ratingFilter?: number;
}

export async function ProductReviews({
  tenantId,
  productId,
  productSlug,
  storeSlug,
  productName = "this product",
  sortBy = "newest",
  ratingFilter,
}: ProductReviewsProps) {
  // Fetch data in parallel
  const [reviews, reviewStats, reviewMedia, user] = await Promise.all([
    getProductReviews(tenantId, productId, sortBy, ratingFilter),
    getProductReviewStats(tenantId, productId),
    getProductReviewMedia(tenantId, productId),
    getUser(),
  ]);

  // Check if user can review, get their votes, and fetch existing review
  const [canReviewResult, userVotes, userExistingReview] = await Promise.all([
    canReviewProductAction(tenantId, productId),
    user
      ? getUserReviewVotes(
          user.id,
          reviews.map((r) => r.id)
        )
      : ({} as Record<string, boolean>),
    user ? getUserProductReview(tenantId, productId, user.id) : null,
  ]);

  const canReview = canReviewResult.data?.canReview ?? false;
  const eligibleOrderIds =
    canReviewResult.data && "eligibleOrderIds" in canReviewResult.data
      ? (canReviewResult.data.eligibleOrderIds ?? [])
      : [];
  const eligibleOrderId = eligibleOrderIds[0] ?? null;
  const hasExistingReview = !!userExistingReview;

  const isFiltered = !!ratingFilter;
  const totalReviewsCount = reviewStats.totalReviews;
  const filteredCount = reviews.length;
  const hasReviews = totalReviewsCount > 0;

  // scroll-mt was 32px, far short of the header, so every #reviews link landed
  // with the heading hidden behind it.
  return (
    <div id="reviews" className="scroll-mt-[var(--store-sticky-top)]">
      {/* Section Header */}
      <div className="pb-6 border-b">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Customer Reviews
            </h2>
            {hasReviews && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 rounded-full">
                <Star className="size-4 fill-amber-500 text-amber-500" />
                <span className="text-sm font-semibold text-amber-700">
                  {reviewStats.averageRating?.toFixed(1)}
                </span>
              </div>
            )}
          </div>
          {hasReviews && (
            <p className="text-muted-foreground">
              Based on {totalReviewsCount}{" "}
              {totalReviewsCount === 1 ? "review" : "reviews"} from verified
              buyers
            </p>
          )}
        </div>
      </div>

      {/* Main Content */}
      {!hasReviews ? (
        <div className="mt-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Left Column - Write Review Form / Existing Review */}
          <div className="xl:col-span-5 space-y-6">
            {hasExistingReview ? (
              <UserExistingReview
                review={userExistingReview}
                tenantId={tenantId}
                storeSlug={storeSlug}
              />
            ) : (
              <ReviewInlineForm
                tenantId={tenantId}
                productId={productId}
                productSlug={productSlug}
                productName={productName}
                storeSlug={storeSlug}
                eligibleOrderId={eligibleOrderId}
                canReview={canReview}
                isLoggedIn={!!user}
              />
            )}
          </div>

          {/* Right Column - Empty State */}
          <div className="xl:col-span-7">
            <EmptyReviewsState />
          </div>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Left Column - Rating Summary, Photo Gallery, Write Review Form */}
          <div className="xl:col-span-4 space-y-6">
            {/* Rating Breakdown - Sticky on desktop */}
            <div className="xl:sticky xl:top-[var(--store-sticky-top)] space-y-6">
              <Suspense fallback={<ReviewBreakdownSkeleton />}>
                <ReviewRatingBreakdown
                  averageRating={reviewStats.averageRating}
                  totalReviews={reviewStats.totalReviews}
                  ratingDistribution={reviewStats.ratingDistribution}
                />
              </Suspense>

              {/* Customer photo gallery (UGC) - Show below breakdown on desktop */}
              {reviewMedia.length > 0 && (
                <div className="hidden xl:block">
                  <ReviewPhotoGallery media={reviewMedia} maxDisplay={6} />
                </div>
              )}

              {/* Inline Form or Existing Review - Desktop only */}
              <div className="hidden xl:block">
                {hasExistingReview ? (
                  <UserExistingReview
                    review={userExistingReview}
                    tenantId={tenantId}
                    storeSlug={storeSlug}
                  />
                ) : (
                  <ReviewInlineForm
                    tenantId={tenantId}
                    productId={productId}
                    productSlug={productSlug}
                    productName={productName}
                    storeSlug={storeSlug}
                    eligibleOrderId={eligibleOrderId}
                    canReview={canReview}
                    isLoggedIn={!!user}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Reviews List */}
          <div className="xl:col-span-8">
            {/* Mobile Photo Gallery */}
            {reviewMedia.length > 0 && (
              <div className="xl:hidden mb-6">
                <ReviewPhotoGallery media={reviewMedia} />
              </div>
            )}

            {/* Inline Form or Existing Review - Mobile only */}
            <div className="xl:hidden mb-6">
              {hasExistingReview ? (
                <UserExistingReview
                  review={userExistingReview}
                  tenantId={tenantId}
                  storeSlug={storeSlug}
                />
              ) : (
                <ReviewInlineForm
                  tenantId={tenantId}
                  productId={productId}
                  productSlug={productSlug}
                  productName={productName}
                  storeSlug={storeSlug}
                  eligibleOrderId={eligibleOrderId}
                  canReview={canReview}
                  isLoggedIn={!!user}
                />
              )}
            </div>

            {/* Sort & Filter Bar */}
            {/* Pins flush below the header — top-0 put it behind the header */}
            <div className="flex items-center justify-between gap-4 pb-4 mb-4 border-b sticky top-[var(--store-header-h)] bg-background/95 backdrop-blur-sm z-10 -mx-1 px-1">
              <div className="flex items-center gap-2 text-sm">
                {isFiltered ? (
                  <div className="flex items-center gap-2">
                    <Filter className="size-4 text-amber-600" />
                    <span className="text-muted-foreground">
                      Showing{" "}
                      <span className="font-medium text-foreground">
                        {filteredCount}
                      </span>{" "}
                      of {totalReviewsCount}
                    </span>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                      {ratingFilter} stars
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {filteredCount}
                    </span>{" "}
                    {filteredCount === 1 ? "review" : "reviews"}
                  </span>
                )}
              </div>
              <Suspense fallback={null}>
                <ReviewSortSelect currentSort={sortBy} />
              </Suspense>
            </div>

            {/* Reviews or Empty Filter State */}
            {filteredCount === 0 && isFiltered ? (
              <NoFilteredResultsState ratingFilter={ratingFilter} />
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    tenantId={tenantId}
                    userVote={userVotes[review.id] ?? null}
                    isLoggedIn={!!user}
                    isOwnReview={!!user && review.userId === user.id}
                    storeSlug={storeSlug}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Empty state when there are no reviews at all
function EmptyReviewsState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center mt-8">
      <div className="relative mb-8">
        <div className="size-24 rounded-3xl bg-linear-to-br from-amber-100 to-orange-100 flex items-center justify-center shadow-lg shadow-amber-100/50">
          <MessageSquare className="size-12 text-amber-600" />
        </div>
        <div className="absolute -top-2 -right-2 size-10 rounded-full bg-linear-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
          <Sparkles className="size-5 text-primary-foreground" />
        </div>
      </div>
      <h3 className="text-2xl font-bold mb-3">No reviews yet</h3>
      <p className="text-muted-foreground max-w-md leading-relaxed">
        Be the first to share your experience with this product! Your honest
        review helps other customers make informed decisions.
      </p>
    </div>
  );
}

// Empty state when filter returns no results
function NoFilteredResultsState({ ratingFilter }: { ratingFilter?: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center bg-linear-to-br from-muted/30 to-muted/10 rounded-2xl border border-dashed">
      <div className="flex items-center gap-1.5 mb-5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`size-7 transition-colors ${
              star <= (ratingFilter || 0)
                ? "fill-amber-400 text-amber-400"
                : "fill-muted text-muted"
            }`}
          />
        ))}
      </div>
      <h3 className="text-lg font-semibold mb-2">
        No {ratingFilter}-star reviews found
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        There are no reviews matching this filter. Try selecting a different
        rating or clear the filter to see all reviews.
      </p>
    </div>
  );
}

// Skeleton for rating breakdown while loading
function ReviewBreakdownSkeleton() {
  return (
    <div className="p-5 sm:p-6 bg-card border rounded-2xl animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center gap-4 pb-5 mb-5 border-b">
        <div className="h-14 w-20 bg-muted rounded" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="size-5 bg-muted rounded" />
            ))}
          </div>
          <div className="h-5 w-20 bg-muted rounded-full" />
        </div>
      </div>
      {/* Bars skeleton */}
      <div className="space-y-2">
        {[5, 4, 3, 2, 1].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-8 h-4 bg-muted rounded" />
            <div className="flex-1 h-2 bg-muted rounded-full" />
            <div className="w-8 h-4 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
