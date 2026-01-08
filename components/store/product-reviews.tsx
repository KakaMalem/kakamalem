import { Star, MessageSquare } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Customer Reviews</h2>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`size-5 ${
                    star <= Math.round(averageRating)
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground"
                  }`}
                />
              ))}
            </div>
            <span className="font-medium">{averageRating.toFixed(1)}</span>
            <span className="text-muted-foreground">
              ({reviews.length} {reviews.length === 1 ? "review" : "reviews"})
            </span>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="size-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No reviews yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Be the first to share your experience with this product.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {review.customerSnapshot.name}
                    </CardTitle>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`size-4 ${
                              star <= review.rating
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted-foreground"
                            }`}
                          />
                        ))}
                      </div>
                      {review.isVerifiedPurchase && (
                        <span className="text-xs text-green-600">
                          Verified Purchase
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {review.title && (
                  <h4 className="mb-2 font-medium">{review.title}</h4>
                )}
                {review.comment && (
                  <p className="text-sm text-muted-foreground">
                    {review.comment}
                  </p>
                )}

                {/* Owner Reply */}
                {review.replyContent && (
                  <div className="mt-4 rounded-md bg-muted p-3">
                    <p className="mb-1 text-sm font-medium">Store Response</p>
                    <p className="text-sm text-muted-foreground">
                      {review.replyContent}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
