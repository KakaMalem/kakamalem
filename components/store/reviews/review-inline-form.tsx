"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  X,
  BadgeCheck,
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

export function ReviewInlineForm(props: ReviewInlineFormProps) {
  const {
    tenantId,
    productId,
    productSlug,
    storeSlug,
    eligibleOrderId,
    canReview,
    isLoggedIn,
  } = props;
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

  useEffect(() => {
    if (!isLoggedIn) return;

    try {
      const pendingData = sessionStorage.getItem(PENDING_REVIEW_KEY);
      if (!pendingData) return;

      const pending: PendingReviewData = JSON.parse(pendingData);

      const isStale = Date.now() - pending.timestamp > 60 * 60 * 1000;
      if (pending.productId !== productId || isStale) {
        sessionStorage.removeItem(PENDING_REVIEW_KEY);
        return;
      }

      setRating(pending.rating);
      setTitle(pending.title);
      setComment(pending.comment);

      sessionStorage.removeItem(PENDING_REVIEW_KEY);

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
          mediaIds: [],
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

    const newPreviewUrls = validFiles.map((file) => URL.createObjectURL(file));

    setSelectedImages((prev) => [...prev, ...validFiles]);
    setImagePreviewUrls((prev) => [...prev, ...newPreviewUrls]);

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

      const returnUrl = `/store/${storeSlug}/product/${productSlug}#reviews`;
      router.push(
        `/store/${storeSlug}/auth/login?redirect=${encodeURIComponent(returnUrl)}`
      );
      return;
    }

    startTransition(async () => {
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

      setRating(0);
      setTitle("");
      setComment("");
      setSelectedImages([]);
      setImagePreviewUrls([]);
      router.refresh();
    });
  };

  const isVerifiedReview = canReview && eligibleOrderId !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full max-w-[384px] mx-auto xl:max-w-none xl:mx-0"
    >
      <div className="bg-card rounded-xl border shadow-sm">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b">
          <h3 className="text-base font-semibold tracking-tight">
            Write a Review
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Share your experience with this product
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
                className="flex items-center gap-2 text-sm text-primary bg-primary/5 px-3 py-2.5 rounded-lg border border-primary/10"
              >
                <Loader2 className="size-4 animate-spin shrink-0" />
                <span>Submitting your review...</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Status badge */}
          <AnimatePresence mode="wait">
            {isLoggedIn ? (
              isVerifiedReview && (
                <motion.div
                  key="verified"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-2 text-sm bg-emerald-50 text-emerald-700 px-3 py-2.5 rounded-lg"
                >
                  <BadgeCheck className="size-4 shrink-0" />
                  <span className="font-medium">Verified Purchase</span>
                </motion.div>
              )
            ) : (
              <motion.div
                key="login-hint"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-start gap-2 text-sm bg-muted/60 text-muted-foreground px-3 py-2.5 rounded-lg"
              >
                <LogIn className="size-4 shrink-0 mt-0.5" />
                <span>You&apos;ll be asked to sign in when you submit.</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Rating */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Your Rating <span className="text-destructive">*</span>
            </Label>
            <ReviewRatingInput
              value={rating}
              onChange={setRating}
              disabled={isPending}
              size="lg"
            />
            {errors.rating && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-destructive flex items-center gap-1.5"
              >
                <AlertCircle className="size-3.5 shrink-0" />
                {errors.rating}
              </motion.p>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="review-title" className="text-sm font-medium">
              Title{" "}
              <span className="text-muted-foreground font-normal">
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
            />
            {errors.title && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-destructive flex items-center gap-1.5"
              >
                <AlertCircle className="size-3.5 shrink-0" />
                {errors.title}
              </motion.p>
            )}
          </div>

          {/* Comment */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="review-comment" className="text-sm font-medium">
                Review{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              {comment.length > 0 && (
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    comment.length > MAX_COMMENT_LENGTH * 0.9
                      ? "text-amber-600"
                      : "text-muted-foreground"
                  )}
                >
                  {comment.length.toLocaleString()}/
                  {MAX_COMMENT_LENGTH.toLocaleString()}
                </span>
              )}
            </div>
            <Textarea
              id="review-comment"
              placeholder="What did you like or dislike?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={isPending}
              rows={4}
              maxLength={MAX_COMMENT_LENGTH}
              className="resize-none"
            />
            {errors.comment && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-destructive flex items-center gap-1.5"
              >
                <AlertCircle className="size-3.5 shrink-0" />
                {errors.comment}
              </motion.p>
            )}
          </div>

          {/* Image Upload */}
          {isLoggedIn && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Photos{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>

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
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="relative size-16 rounded-lg overflow-hidden bg-muted border group"
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
                          className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center"
                        >
                          <X className="size-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

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
                    className="h-8 text-xs gap-1.5"
                  >
                    <ImagePlus className="size-3.5" />
                    {selectedImages.length > 0 ? "Add More" : "Add Photos"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Up to {MAX_IMAGES} images, 5MB each
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          <div className="pt-3">
            <Button
              type="submit"
              disabled={isPending || rating === 0}
              className="w-full"
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
                  Sign In & Submit
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
