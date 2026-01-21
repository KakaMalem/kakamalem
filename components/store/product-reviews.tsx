import { Star, MessageSquare, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getProductReviews } from "@/lib/db/queries/reviews";

interface ProductReviewsProps {
  tenantId: string;
  productId: string;
  storeSlug: string;
}

export async function ProductReviews({
  tenantId,
  productId,
}: ProductReviewsProps) {
  const reviews = await getProductReviews(tenantId, productId);

  // Calculate average rating
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  return (
    <div id="reviews" className="scroll-mt-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-xl sm:text-2xl font-bold">Customer Reviews</h2>
        {reviews.length > 0 && (
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-bold">
                {averageRating.toFixed(1)}
              </span>
              <Star className="size-5 fill-amber-500 text-amber-500" />
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex flex-col">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`size-3.5 ${
                      star <= Math.round(averageRating)
                        ? "fill-amber-400 text-amber-400"
                        : "fill-muted text-muted"
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground mt-0.5">
                {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
              </span>
            </div>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center bg-muted/20 rounded-2xl">
          <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <MessageSquare className="size-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-medium">No reviews yet</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs">
            Be the first to share your experience with this product.
          </p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="p-4 sm:p-5 bg-muted/20 rounded-xl"
            >
              {/* Review header */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  {/* Avatar placeholder */}
                  <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {review.customerSnapshot.name?.charAt(0)?.toUpperCase() ||
                        "?"}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {review.customerSnapshot.name}
                      </span>
                      {review.isVerifiedPurchase && (
                        <Badge
                          variant="secondary"
                          className="text-xs gap-1 bg-green-100 text-green-700 hover:bg-green-100"
                        >
                          <CheckCircle2 className="size-3" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`size-3.5 ${
                              star <= review.rating
                                ? "fill-amber-400 text-amber-400"
                                : "fill-muted text-muted"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <time className="text-xs text-muted-foreground">
                  {new Date(review.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              </div>

              {/* Review content */}
              <div className="space-y-2">
                {review.title && (
                  <h4 className="font-medium text-sm">{review.title}</h4>
                )}
                {review.comment && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {review.comment}
                  </p>
                )}
              </div>

              {/* Owner Reply */}
              {review.replyContent && (
                <div className="mt-4 p-3 rounded-lg bg-primary/5 border-l-2 border-primary">
                  <p className="text-xs font-medium text-primary mb-1">
                    Store Response
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {review.replyContent}
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
