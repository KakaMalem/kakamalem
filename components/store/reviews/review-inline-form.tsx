"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  X,
  BadgeCheck,
  Sparkles,
  ImagePlus,
  AlertCircle,
  LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ReviewRatingInput } from "./review-rating-input";
import { submitReviewAction } from "@/lib/actions/reviews";
import { createMediaRecord } from "@/lib/actions/media";
import { reviewSchema } from "@/lib/validations/reviews";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Helper function to upload a single image
async function uploadImage(
  file: File,
  tenantId: string
): Promise<{ id: string; url: string } | null> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("tenantId", tenantId);
    formData.append("folder", "media");

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Upload failed");
    }

    const data = await response.json();

    // Create media record in database
    const mediaResult = await createMediaRecord(tenantId, {
      url: data.file.url,
      fileName: data.file.originalName || data.file.filename,
      fileSize: data.file.size,
      mimeType: data.file.mimeType,
      width: data.file.width,
      height: data.file.height,
    });

    if (!mediaResult.success || !mediaResult.data) {
      throw new Error("Failed to create media record");
    }

    return { id: mediaResult.data.id, url: mediaResult.data.url };
  } catch (error) {
    console.error("Error uploading image:", error);
    return null;
  }
}

// Storage key for pending review data
const PENDING_REVIEW_KEY = "pending_review";

interface PendingReviewData {
  tenantId: string;
  productId: string;
  rating: number;
  title: string;
  comment: string;
  timestamp: number;
}

interface ReviewInlineFormProps {
  tenantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  storeSlug: string;
  eligibleOrderId: string | null;
  canReview: boolean;
  isLoggedIn: boolean;
}

const MAX_IMAGES = 5;
const MAX_COMMENT_LENGTH = 5000;

export function ReviewInlineForm({
  tenantId,
  productId,
  productSlug,
  productName,
  storeSlug,
  eligibleOrderId,
  canReview,
  isLoggedIn,
}: ReviewInlineFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check for pending review data on mount (after login redirect)
  useEffect(() => {
    if (!isLoggedIn) return;

    try {
      const pendingData = sessionStorage.getItem(PENDING_REVIEW_KEY);
      if (!pendingData) return;

      const pending: PendingReviewData = JSON.parse(pendingData);

      // Check if it's for this product and not too old (1 hour)
      const isStale = Date.now() - pending.timestamp > 60 * 60 * 1000;
      if (pending.productId !== productId || isStale) {
        sessionStorage.removeItem(PENDING_REVIEW_KEY);
        return;
      }

      // Restore form data and auto-submit
      setRating(pending.rating);
      setTitle(pending.title);
      setComment(pending.comment);

      // Clear the pending data
      sessionStorage.removeItem(PENDING_REVIEW_KEY);

      // Auto-submit after a short delay to show user the form is filled
      setIsAutoSubmitting(true);
      const timer = setTimeout(() => {
        submitPendingReview(pending);
      }, 500);

      return () => clearTimeout(timer);
    } catch (error) {
      console.error("Error restoring pending review:", error);
      sessionStorage.removeItem(PENDING_REVIEW_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, productId]);

  const submitPendingReview = async (pending: PendingReviewData) => {
    startTransition(async () => {
      const response = await submitReviewAction(
        pending.tenantId,
        pending.productId,
        eligibleOrderId,
        {
          rating: pending.rating,
          title: pending.title || undefined,
          comment: pending.comment || undefined,
          mediaIds: [], // Images aren't persisted through login
        }
      );

      setIsAutoSubmitting(false);

      if (response.error) {
        toast.error(response.error.message);
        return;
      }

      toast.success("Thank you for your review!", {
        description: "Your feedback helps other customers.",
      });

      // Reset form
      setRating(0);
      setTitle("");
      setComment("");
      router.refresh();
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remainingSlots = MAX_IMAGES - selectedImages.length;

    if (files.length > remainingSlots) {
      toast.error(`You can only upload ${MAX_IMAGES} images`);
      return;
    }

    // Validate file types and sizes
    const validFiles = files.filter((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 5MB)`);
        return false;
      }
      return true;
    });

    // Create preview URLs
    const newPreviewUrls = validFiles.map((file) => URL.createObjectURL(file));

    setSelectedImages((prev) => [...prev, ...validFiles]);
    setImagePreviewUrls((prev) => [...prev, ...newPreviewUrls]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviewUrls[index]);
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate
    const result = reviewSchema.safeParse({
      rating,
      title: title || undefined,
      comment: comment || undefined,
      mediaIds: [],
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    // If not logged in, store data and redirect to login
    if (!isLoggedIn) {
      const pendingData: PendingReviewData = {
        tenantId,
        productId,
        rating,
        title,
        comment,
        timestamp: Date.now(),
      };

      sessionStorage.setItem(PENDING_REVIEW_KEY, JSON.stringify(pendingData));

      // Redirect to login with return URL
      const returnUrl = `/store/${storeSlug}/product/${productSlug}#reviews`;
      router.push(
        `/store/${storeSlug}/auth/login?redirect=${encodeURIComponent(returnUrl)}`
      );
      return;
    }

    startTransition(async () => {
      // Upload images first if any are selected
      let mediaIds: string[] = [];

      if (selectedImages.length > 0) {
        toast.loading("Uploading images...", { id: "upload-images" });

        const uploadPromises = selectedImages.map((file) =>
          uploadImage(file, tenantId)
        );

        const uploadResults = await Promise.all(uploadPromises);
        const successfulUploads = uploadResults.filter(
          (result): result is { id: string; url: string } => result !== null
        );

        if (successfulUploads.length !== selectedImages.length) {
          toast.error(
            `${selectedImages.length - successfulUploads.length} image(s) failed to upload`,
            { id: "upload-images" }
          );
        } else {
          toast.dismiss("upload-images");
        }

        mediaIds = successfulUploads.map((upload) => upload.id);
      }

      // Submit the review with uploaded media IDs
      const response = await submitReviewAction(
        tenantId,
        productId,
        eligibleOrderId,
        {
          rating,
          title: title || undefined,
          comment: comment || undefined,
          mediaIds,
        }
      );

      if (response.error) {
        toast.error(response.error.message);
        return;
      }

      toast.success("Thank you for your review!", {
        description: "Your feedback helps other customers.",
      });

      // Reset form
      setRating(0);
      setTitle("");
      setComment("");
      setSelectedImages([]);
      setImagePreviewUrls([]);
      router.refresh();
    });
  };

  const isVerifiedReview = canReview && eligibleOrderId !== null;
  const commentProgress = (comment.length / MAX_COMMENT_LENGTH) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-amber-500" />
          <h3 className="font-semibold">Share Your Experience</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Help others by sharing your thoughts about {productName}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        {/* Auto-submitting indicator */}
        <AnimatePresence>
          {isAutoSubmitting && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 text-sm text-primary bg-primary/10 px-4 py-3 rounded-xl"
            >
              <Loader2 className="size-4 animate-spin" />
              Submitting your review...
            </motion.div>
          )}
        </AnimatePresence>

        {/* Verified purchase / Guest notice */}
        <AnimatePresence mode="wait">
          {isLoggedIn ? (
            isVerifiedReview ? (
              <motion.div
                key="verified"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-200"
              >
                <BadgeCheck className="size-5 shrink-0" />
                <div>
                  <span className="font-medium">Verified Purchase</span>
                  <p className="text-emerald-600 text-xs mt-0.5">
                    Your review will be marked as verified
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="guest"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-sm text-muted-foreground bg-muted/50 px-4 py-3 rounded-xl"
              >
                Share your thoughts about this product
              </motion.div>
            )
          ) : (
            <motion.div
              key="login-hint"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 px-4 py-3 rounded-xl border border-blue-200"
            >
              <LogIn className="size-4 shrink-0" />
              <span>
                Fill out your review below. You&apos;ll be asked to log in when
                you submit.
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rating */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            Overall Rating <span className="text-destructive">*</span>
          </Label>
          <ReviewRatingInput
            value={rating}
            onChange={setRating}
            disabled={isPending}
            size="lg"
          />
          {errors.rating && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="size-3.5" />
              {errors.rating}
            </p>
          )}
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="review-title">
            Review Title{" "}
            <span className="text-muted-foreground font-normal text-xs">
              (optional)
            </span>
          </Label>
          <Input
            id="review-title"
            placeholder="Summarize your experience"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isPending}
            maxLength={255}
            className="h-11"
          />
          {errors.title && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="size-3.5" />
              {errors.title}
            </p>
          )}
        </div>

        {/* Comment */}
        <div className="space-y-2">
          <Label htmlFor="review-comment">
            Your Review{" "}
            <span className="text-muted-foreground font-normal text-xs">
              (optional)
            </span>
          </Label>
          <Textarea
            id="review-comment"
            placeholder="What did you like? What could be better?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={isPending}
            rows={4}
            maxLength={MAX_COMMENT_LENGTH}
            className="resize-none"
          />
          <div className="flex items-center justify-between">
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden mr-3">
              <motion.div
                className={cn(
                  "h-full rounded-full transition-colors",
                  commentProgress > 90
                    ? "bg-amber-500"
                    : commentProgress > 75
                      ? "bg-lime-500"
                      : "bg-primary"
                )}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(commentProgress, 100)}%` }}
              />
            </div>
            <span
              className={cn(
                "text-xs tabular-nums",
                commentProgress > 90
                  ? "text-amber-600"
                  : "text-muted-foreground"
              )}
            >
              {comment.length.toLocaleString()}/
              {MAX_COMMENT_LENGTH.toLocaleString()}
            </span>
          </div>
          {errors.comment && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="size-3.5" />
              {errors.comment}
            </p>
          )}
        </div>

        {/* Image Upload - Only for logged in users */}
        {isLoggedIn && (
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <ImagePlus className="size-4" />
              Add Photos{" "}
              <span className="text-muted-foreground font-normal text-xs">
                (optional, max {MAX_IMAGES})
              </span>
            </Label>

            {/* Image previews */}
            <AnimatePresence>
              {imagePreviewUrls.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex gap-2 flex-wrap"
                >
                  {imagePreviewUrls.map((url, index) => (
                    <motion.div
                      key={url}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="relative size-20 rounded-lg overflow-hidden bg-muted group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Preview ${index + 1}`}
                        className="size-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 size-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                      >
                        <X className="size-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Upload button */}
            {selectedImages.length < MAX_IMAGES && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                  disabled={isPending}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPending}
                  className="gap-2"
                >
                  <ImagePlus className="size-4" />
                  {selectedImages.length > 0 ? "Add More" : "Add Photos"}
                </Button>
                <p className="text-xs text-muted-foreground mt-1.5">
                  JPEG, PNG up to 5MB each
                </p>
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <div className="pt-2 border-t">
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <Button
              type="submit"
              disabled={isPending || rating === 0}
              className="w-full h-11"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : isLoggedIn ? (
                "Submit Review"
              ) : (
                <>
                  <LogIn className="size-4 mr-2" />
                  Log In & Submit Review
                </>
              )}
            </Button>
          </motion.div>
        </div>
      </form>
    </motion.div>
  );
}
