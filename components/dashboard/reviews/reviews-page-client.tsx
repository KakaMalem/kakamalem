"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Star,
  MessageSquare,
  CheckCircle2,
  Search,
  ChevronLeft,
  ChevronRight,
  Reply,
  Trash2,
  ThumbsUp,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  replyToReviewAction,
  deleteReviewReplyAction,
} from "@/lib/actions/reviews";
import type {
  DashboardReview,
  ReviewStats,
} from "@/lib/db/queries/dashboard-reviews";

interface ReviewsPageClientProps {
  storeSlug: string;
  tenantId: string;
  reviews: DashboardReview[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: ReviewStats;
  searchParams: Record<string, string | undefined>;
}

export function ReviewsPageClient({
  storeSlug,
  tenantId,
  reviews,
  pagination,
  stats,
  searchParams,
}: ReviewsPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(searchParams.search || "");

  // Highlighted review (from notification click)
  const [highlightedReviewId, setHighlightedReviewId] = useState<string | null>(
    searchParams.reviewId || null
  );
  const reviewRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Scroll to and highlight the review from notification
  useEffect(() => {
    if (highlightedReviewId) {
      const reviewElement = reviewRefs.current.get(highlightedReviewId);
      if (reviewElement) {
        // Scroll to the review with some offset for header
        setTimeout(() => {
          reviewElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);

        // Clear highlight and URL param after animation
        const timer = setTimeout(() => {
          setHighlightedReviewId(null);
          // Remove reviewId from URL without navigation
          const params = new URLSearchParams(window.location.search);
          params.delete("reviewId");
          const newUrl = params.toString()
            ? `${window.location.pathname}?${params.toString()}`
            : window.location.pathname;
          window.history.replaceState({}, "", newUrl);
        }, 3000);

        return () => clearTimeout(timer);
      }
    }
  }, [highlightedReviewId]);

  // Reply dialog state
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<DashboardReview | null>(
    null
  );
  const [replyContent, setReplyContent] = useState("");

  // Update URL with filters
  const updateFilters = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams();

    // Preserve existing params
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value && key !== "page") {
        params.set(key, value);
      }
    });

    // Apply updates
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    // Reset to page 1 when filters change
    params.delete("page");

    router.push(`/dashboard/${storeSlug}/reviews?${params.toString()}`);
  };

  // Handle search
  const handleSearch = () => {
    updateFilters({ search: searchValue || undefined });
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    params.set("page", newPage.toString());
    router.push(`/dashboard/${storeSlug}/reviews?${params.toString()}`);
  };

  // Open reply dialog
  const handleReply = (review: DashboardReview) => {
    setSelectedReview(review);
    setReplyContent(review.replyContent || "");
    setReplyDialogOpen(true);
  };

  // Submit reply
  const handleSubmitReply = async () => {
    if (!selectedReview || !replyContent.trim()) return;

    startTransition(async () => {
      const result = await replyToReviewAction(
        tenantId,
        selectedReview.id,
        replyContent
      );

      if (result.error) {
        toast.error(result.error.message);
        return;
      }

      toast.success("Reply posted successfully");
      setReplyDialogOpen(false);
      setSelectedReview(null);
      setReplyContent("");
      router.refresh();
    });
  };

  // Delete reply
  const handleDeleteReply = async (reviewId: string) => {
    startTransition(async () => {
      const result = await deleteReviewReplyAction(tenantId, reviewId);

      if (result.error) {
        toast.error(result.error.message);
        return;
      }

      toast.success("Reply deleted");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Reviews</h1>
        <p className="text-muted-foreground">
          Manage customer reviews and respond to feedback
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Reviews</CardDescription>
            <CardTitle className="text-2xl">{stats.totalReviews}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Rating</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-1">
              {stats.avgRating || "0.0"}
              <Star className="size-5 fill-amber-500 text-amber-500" />
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Replies</CardDescription>
            <CardTitle className="text-2xl">{stats.pendingReplies}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>This Week</CardDescription>
            <CardTitle className="text-2xl">{stats.recentReviews}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Rating Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rating Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = stats[`rating${rating}` as keyof typeof stats] || 0;
              const percentage =
                stats.totalReviews > 0
                  ? (Number(count) / stats.totalReviews) * 100
                  : 0;
              return (
                <div key={rating} className="flex items-center gap-2">
                  <span className="text-sm w-3">{rating}</span>
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-10 text-right">
                    {Number(count)}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex gap-2">
          <Input
            placeholder="Search reviews..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="max-w-xs"
          />
          <Button variant="outline" size="icon" onClick={handleSearch}>
            <Search className="size-4" />
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Select
            value={searchParams.rating || "all"}
            onValueChange={(v) => updateFilters({ rating: v })}
          >
            <SelectTrigger className="w-32.5">
              <SelectValue placeholder="Rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              <SelectItem value="5">5 Stars</SelectItem>
              <SelectItem value="4">4 Stars</SelectItem>
              <SelectItem value="3">3 Stars</SelectItem>
              <SelectItem value="2">2 Stars</SelectItem>
              <SelectItem value="1">1 Star</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={searchParams.hasReply || "all"}
            onValueChange={(v) => updateFilters({ hasReply: v })}
          >
            <SelectTrigger className="w-32.5">
              <SelectValue placeholder="Reply Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="no">Needs Reply</SelectItem>
              <SelectItem value="yes">Replied</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={searchParams.isVerified || "all"}
            onValueChange={(v) => updateFilters({ isVerified: v })}
          >
            <SelectTrigger className="w-37.5">
              <SelectValue placeholder="Verified" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reviews</SelectItem>
              <SelectItem value="yes">Verified Only</SelectItem>
              <SelectItem value="no">Unverified</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="size-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No reviews yet</h3>
            <p className="text-sm text-muted-foreground">
              Reviews will appear here when customers leave feedback
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card
              key={review.id}
              ref={(el) => {
                if (el) {
                  reviewRefs.current.set(review.id, el);
                } else {
                  reviewRefs.current.delete(review.id);
                }
              }}
              className={cn(
                "transition-all duration-500",
                highlightedReviewId === review.id &&
                  "ring-2 ring-primary ring-offset-2 bg-primary/5"
              )}
            >
              <CardContent className="p-4">
                {/* Review header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-primary">
                        {review.customerSnapshot.name
                          ?.charAt(0)
                          ?.toUpperCase() || "?"}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {review.customerSnapshot.name}
                        </span>
                        {review.isVerifiedPurchase && (
                          <Badge
                            variant="secondary"
                            className="text-xs gap-1 bg-green-100 text-green-700"
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
                              className={cn(
                                "size-4",
                                star <= review.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "fill-muted text-muted"
                              )}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Product link */}
                  {review.product && (
                    <a
                      href={`/dashboard/${storeSlug}/products/${review.product.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {review.product.name}
                    </a>
                  )}
                </div>

                {/* Review content */}
                <div className="space-y-2 mb-3">
                  {review.title && (
                    <h4 className="font-medium">{review.title}</h4>
                  )}
                  {review.comment && (
                    <p className="text-sm text-muted-foreground">
                      {review.comment}
                    </p>
                  )}
                </div>

                {/* Review images */}
                {review.images && review.images.length > 0 && (
                  <div className="flex gap-2 mb-3">
                    {review.images.map((img) => (
                      <div
                        key={img.id}
                        className="size-16 rounded-lg overflow-hidden bg-muted"
                      >
                        {img.media?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img.media.url}
                            alt="Review"
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="size-full flex items-center justify-center">
                            <ImageIcon className="size-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Helpful votes */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="size-4" />
                    {review.helpfulVotesUp} helpful
                  </span>
                </div>

                {/* Owner reply */}
                {review.replyContent ? (
                  <div className="p-3 rounded-lg bg-primary/5 border-l-2 border-primary">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-primary">
                        Your Response
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => handleDeleteReply(review.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="size-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {review.replyContent}
                    </p>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReply(review)}
                  >
                    <Reply className="size-4 mr-2" />
                    Reply
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Reply Dialog */}
      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply to Review</DialogTitle>
            <DialogDescription>
              Respond to {selectedReview?.customerSnapshot.name}&apos;s review
            </DialogDescription>
          </DialogHeader>

          {selectedReview && (
            <div className="space-y-4">
              {/* Show original review */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex gap-0.5 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        "size-4",
                        star <= selectedReview.rating
                          ? "fill-amber-400 text-amber-400"
                          : "fill-muted text-muted"
                      )}
                    />
                  ))}
                </div>
                {selectedReview.title && (
                  <p className="font-medium text-sm">{selectedReview.title}</p>
                )}
                {selectedReview.comment && (
                  <p className="text-sm text-muted-foreground">
                    {selectedReview.comment}
                  </p>
                )}
              </div>

              {/* Reply textarea */}
              <Textarea
                placeholder="Write your response..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={4}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {replyContent.length}/2000
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReplyDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReply}
              disabled={isPending || !replyContent.trim()}
            >
              {selectedReview?.replyContent ? "Update Reply" : "Post Reply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
