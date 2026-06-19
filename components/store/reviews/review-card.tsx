"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { safeFormatDistanceToNow } from "@/lib/utils/safe-date";
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Pencil,
  Trash2,
  PenLine,
} from "lucide-react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { voteOnReviewAction, deleteReviewAction } from "@/lib/actions/reviews";
import { toast } from "sonner";
import type { ProductReview } from "@/lib/db/queries/reviews";
import { ReviewEditDialog } from "./review-edit-dialog";

interface ReviewCardProps {
  review: ProductReview;
  tenantId: string;
  userVote: boolean | null;
  isLoggedIn: boolean;
  isOwnReview?: boolean;
  storeSlug?: string;
}

const COMMENT_PREVIEW_LENGTH = 280;

export function ReviewCard({
  review,
  tenantId,
  userVote,
  isLoggedIn,
  isOwnReview = false,
  storeSlug,
}: ReviewCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentVote, setCurrentVote] = useState<boolean | null>(userVote);
  const [helpfulCount, setHelpfulCount] = useState(review.helpfulVotesUp);
  const [notHelpfulCount, setNotHelpfulCount] = useState(
    review.helpfulVotesDown
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleVote = (isHelpful: boolean) => {
    if (!isLoggedIn) {
      toast.error("Please log in to vote on reviews");
      return;
    }

    startTransition(async () => {
      const response = await voteOnReviewAction(tenantId, review.id, isHelpful);

      if (response.error) {
        toast.error(response.error.message);
        return;
      }

      if (response.data?.action === "removed") {
        if (isHelpful) {
          setHelpfulCount((c) => c - 1);
        } else {
          setNotHelpfulCount((c) => c - 1);
        }
        setCurrentVote(null);
      } else if (response.data?.action === "changed") {
        if (isHelpful) {
          setHelpfulCount((c) => c + 1);
          setNotHelpfulCount((c) => c - 1);
        } else {
          setHelpfulCount((c) => c - 1);
          setNotHelpfulCount((c) => c + 1);
        }
        setCurrentVote(isHelpful);
      } else {
        if (isHelpful) {
          setHelpfulCount((c) => c + 1);
        } else {
          setNotHelpfulCount((c) => c + 1);
        }
        setCurrentVote(isHelpful);
      }
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await deleteReviewAction(tenantId, review.id);
      if (response.error) {
        toast.error(response.error.message);
      } else {
        toast.success("Review deleted successfully");
        router.refresh();
      }
    } catch {
      toast.error("Failed to delete review");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const hasImages = review.images && review.images.length > 0;
  const hasLongComment =
    review.comment && review.comment.length > COMMENT_PREVIEW_LENGTH;
  const displayComment =
    review.comment && hasLongComment && !isExpanded
      ? review.comment.slice(0, COMMENT_PREVIEW_LENGTH) + "..."
      : review.comment;

  // Prepare lightbox slides
  const lightboxSlides =
    review.images?.map((img) => ({
      src: img.media?.url || "",
      alt: `Review image by ${review.customerSnapshot.name}`,
    })) || [];

  // Format relative time
  const relativeTime = safeFormatDistanceToNow(review.createdAt, {
    addSuffix: true,
  });

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 sm:p-5 bg-card border rounded-xl shadow-sm hover:shadow-md transition-shadow"
      >
        {/* Review header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Avatar */}
            <div className="size-11 rounded-full bg-linear-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 ring-2 ring-background shadow-sm">
              <span className="text-sm font-bold text-primary">
                {review.customerSnapshot.name?.charAt(0)?.toUpperCase() || "?"}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm truncate">
                  {review.customerSnapshot.name}
                </span>
                {isOwnReview && (
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    You
                  </span>
                )}
                {review.isVerifiedPurchase && (
                  <motion.span
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"
                  >
                    <BadgeCheck className="size-3.5" />
                    Verified Purchase
                  </motion.span>
                )}
              </div>
              {/* Rating stars */}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
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
                  {relativeTime}
                </span>
                {review.isEdited && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <PenLine className="size-3" />
                    edited
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Edit/Delete dropdown for own reviews */}
          {isOwnReview && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">Review options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={() => setShowEditDialog(true)}
                  className="gap-2 cursor-pointer"
                >
                  <Pencil className="size-4" />
                  Edit review
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4" />
                  Delete review
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Review content */}
        <div className="space-y-2">
          {review.title && (
            <h4 className="font-semibold text-base">{review.title}</h4>
          )}
          {review.comment && (
            <div>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {displayComment}
              </p>
              {hasLongComment && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline mt-1"
                >
                  {isExpanded ? (
                    <>
                      Show less <ChevronUp className="size-3" />
                    </>
                  ) : (
                    <>
                      Read more <ChevronDown className="size-3" />
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Review images */}
        {hasImages && (
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2 -mx-1 px-1">
            {review.images.map((img, index) => (
              <motion.button
                key={img.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setLightboxIndex(index);
                  setLightboxOpen(true);
                }}
                className="relative shrink-0 size-20 sm:size-24 rounded-lg overflow-hidden bg-muted ring-1 ring-border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {img.media?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.media.url}
                    alt={`Review image ${index + 1}`}
                    className="size-full object-cover transition-transform hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="size-full flex items-center justify-center bg-muted">
                    <span className="text-xs text-muted-foreground">
                      No image
                    </span>
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        )}

        {/* Owner Reply */}
        <AnimatePresence>
          {review.replyContent && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-4 rounded-lg bg-primary/5 border-l-4 border-primary"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="size-6 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-[10px] font-bold text-primary-foreground">
                    S
                  </span>
                </div>
                <span className="text-xs font-semibold text-primary">
                  Store Response
                </span>
                {review.repliedAt && (
                  <span className="text-xs text-muted-foreground">
                    ·{" "}
                    {safeFormatDistanceToNow(review.repliedAt, {
                      addSuffix: true,
                    })}
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {review.replyContent}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Helpful votes */}
        <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t">
          <span className="text-xs text-muted-foreground">
            Was this review helpful?
          </span>
          <div className="flex items-center gap-1">
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 px-3 gap-1.5 rounded-full transition-colors",
                  currentVote === true
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                    : "hover:bg-muted"
                )}
                onClick={() => handleVote(true)}
                disabled={isPending}
              >
                <ThumbsUp
                  className={cn(
                    "size-3.5 transition-transform",
                    currentVote === true && "fill-current"
                  )}
                />
                <span className="text-xs font-medium">{helpfulCount}</span>
              </Button>
            </motion.div>
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 px-3 gap-1.5 rounded-full transition-colors",
                  currentVote === false
                    ? "bg-rose-100 text-rose-700 hover:bg-rose-100"
                    : "hover:bg-muted"
                )}
                onClick={() => handleVote(false)}
                disabled={isPending}
              >
                <ThumbsDown
                  className={cn(
                    "size-3.5 transition-transform",
                    currentVote === false && "fill-current"
                  )}
                />
                <span className="text-xs font-medium">{notHelpfulCount}</span>
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.article>

      {/* Lightbox */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={lightboxSlides}
        plugins={[Zoom, Counter]}
        carousel={{ finite: lightboxSlides.length <= 5 }}
        animation={{ fade: 300, swipe: 300 }}
        controller={{ closeOnBackdropClick: true }}
        styles={{
          container: { backgroundColor: "rgba(0, 0, 0, 0.9)" },
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your review?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Your review and all associated data
              (votes, images) will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Review"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      {isOwnReview && storeSlug && (
        <ReviewEditDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          review={review}
          tenantId={tenantId}
          storeSlug={storeSlug}
        />
      )}
    </>
  );
}
