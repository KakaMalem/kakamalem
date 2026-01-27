"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  Star,
  BadgeCheck,
  MessageSquare,
  PenLine,
  Trash2,
  MoreVertical,
} from "lucide-react";
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
import { ReviewEditDialog } from "./review-edit-dialog";
import { deleteReviewAction } from "@/lib/actions/reviews";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { UserProductReview } from "@/lib/db/queries/reviews";
import { cn } from "@/lib/utils";

interface UserExistingReviewProps {
  review: NonNullable<UserProductReview>;
  tenantId: string;
  storeSlug: string;
}

export function UserExistingReview({
  review,
  tenantId,
  storeSlug,
}: UserExistingReviewProps) {
  const router = useRouter();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteReviewAction(tenantId, review.id);
      if (result.error) {
        toast.error(result.error.message);
      } else {
        toast.success("Review deleted");
        router.refresh();
      }
    } catch {
      toast.error("Failed to delete review");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(review.createdAt), {
    addSuffix: true,
  });

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border rounded-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b bg-emerald-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BadgeCheck className="size-5 text-emerald-600" />
            <h3 className="font-semibold text-emerald-800">Your Review</h3>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                <PenLine className="size-4 mr-2" />
                Edit Review
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4 mr-2" />
                Delete Review
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="p-5">
          {/* Rating and meta */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {/* Stars */}
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      "size-5",
                      star <= review.rating
                        ? "fill-amber-400 text-amber-400"
                        : "fill-muted text-muted"
                    )}
                  />
                ))}
              </div>
              {review.isVerifiedPurchase && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <BadgeCheck className="size-3" />
                  Verified
                </span>
              )}
              {review.isEdited && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <PenLine className="size-3" />
                  edited
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>

          {/* Title */}
          {review.title && (
            <h4 className="font-semibold mb-2">{review.title}</h4>
          )}

          {/* Comment */}
          {review.comment ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              {review.comment}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm italic flex items-center gap-2">
              <MessageSquare className="size-4" />
              No written review
            </p>
          )}

          {/* Images */}
          {review.images && review.images.length > 0 && (
            <div className="flex gap-2 mt-4 flex-wrap">
              {review.images.map((img, index) => (
                <div
                  key={img.id}
                  className="size-16 rounded-lg overflow-hidden bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.media.url}
                    alt={`Your photo ${index + 1}`}
                    className="size-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Helpful votes */}
          {(review.helpfulVotesUp > 0 || review.helpfulVotesDown > 0) && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                {review.helpfulVotesUp}{" "}
                {review.helpfulVotesUp === 1 ? "person" : "people"} found this
                helpful
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Edit Dialog */}
      <ReviewEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        review={review}
        tenantId={tenantId}
        storeSlug={storeSlug}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your review?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your review. This action cannot be
              undone.
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
    </>
  );
}
