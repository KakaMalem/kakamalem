"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle, Sparkles, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReviewRatingInput } from "./review-rating-input";
import { editReviewAction } from "@/lib/actions/reviews";
import { createMediaRecord } from "@/lib/actions/media";
import { reviewSchema } from "@/lib/validations/reviews";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ProductReview } from "@/lib/db/queries/reviews";

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

interface ReviewEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: ProductReview;
  tenantId: string;
  storeSlug: string;
}

const MAX_COMMENT_LENGTH = 5000;
const MAX_IMAGES = 5;

// Type for existing images from the review
interface ExistingImage {
  id: string;
  mediaId: string;
  url: string;
}

export function ReviewEditDialog({
  open,
  onOpenChange,
  review,
  tenantId,
}: ReviewEditDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rating, setRating] = useState(review.rating);
  const [title, setTitle] = useState(review.title || "");
  const [comment, setComment] = useState(review.comment || "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track existing images that should be kept
  const [existingImages, setExistingImages] = useState<ExistingImage[]>(() =>
    review.images.map((img) => ({
      id: img.id,
      mediaId: img.mediaId,
      url: img.media.url,
    }))
  );

  // Track new images to be uploaded
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);

  const commentProgress = (comment.length / MAX_COMMENT_LENGTH) * 100;
  const totalImageCount = existingImages.length + newImages.length;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remainingSlots = MAX_IMAGES - totalImageCount;

    if (files.length > remainingSlots) {
      toast.error(`You can only have ${MAX_IMAGES} images total`);
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
    const previews = validFiles.map((file) => URL.createObjectURL(file));

    setNewImages((prev) => [...prev, ...validFiles]);
    setNewImagePreviews((prev) => [...prev, ...previews]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeExistingImage = (mediaId: string) => {
    setExistingImages((prev) => prev.filter((img) => img.mediaId !== mediaId));
  };

  const removeNewImage = (index: number) => {
    URL.revokeObjectURL(newImagePreviews[index]);
    setNewImages((prev) => prev.filter((_, i) => i !== index));
    setNewImagePreviews((prev) => prev.filter((_, i) => i !== index));
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

    startTransition(async () => {
      // Upload new images first
      let newMediaIds: string[] = [];

      if (newImages.length > 0) {
        toast.loading("Uploading images...", { id: "upload-images" });

        const uploadPromises = newImages.map((file) =>
          uploadImage(file, tenantId)
        );

        const uploadResults = await Promise.all(uploadPromises);
        const successfulUploads = uploadResults.filter(
          (result): result is { id: string; url: string } => result !== null
        );

        if (successfulUploads.length !== newImages.length) {
          toast.error(
            `${newImages.length - successfulUploads.length} image(s) failed to upload`,
            { id: "upload-images" }
          );
        } else {
          toast.dismiss("upload-images");
        }

        newMediaIds = successfulUploads.map((upload) => upload.id);
      }

      // Submit the edit with existing images to keep and new images
      const response = await editReviewAction(tenantId, review.id, {
        rating,
        title: title || undefined,
        comment: comment || undefined,
        mediaIds: newMediaIds, // New images to add
        keepMediaIds: existingImages.map((img) => img.mediaId), // Existing images to keep
      });

      if (response.error) {
        toast.error(response.error.message);
        return;
      }

      toast.success("Review updated successfully!");
      onOpenChange(false);
      router.refresh();
    });
  };

  const handleClose = (newOpen: boolean) => {
    if (!isPending) {
      // Reset to original values when closing
      if (!newOpen) {
        setRating(review.rating);
        setTitle(review.title || "");
        setComment(review.comment || "");
        setErrors({});
        setExistingImages(
          review.images.map((img) => ({
            id: img.id,
            mediaId: img.mediaId,
            url: img.media.url,
          }))
        );
        // Clean up preview URLs
        newImagePreviews.forEach((url) => URL.revokeObjectURL(url));
        setNewImages([]);
        setNewImagePreviews([]);
      }
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-amber-500" />
            Edit Your Review
          </DialogTitle>
          <DialogDescription>
            Update your review. Your changes will be saved and marked as edited.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
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
            <Label htmlFor="edit-review-title">
              Review Title{" "}
              <span className="text-muted-foreground font-normal text-xs">
                (optional)
              </span>
            </Label>
            <Input
              id="edit-review-title"
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
            <Label htmlFor="edit-review-comment">
              Your Review{" "}
              <span className="text-muted-foreground font-normal text-xs">
                (optional)
              </span>
            </Label>
            <Textarea
              id="edit-review-comment"
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

          {/* Images Section */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <ImagePlus className="size-4" />
              Photos{" "}
              <span className="text-muted-foreground font-normal text-xs">
                ({totalImageCount}/{MAX_IMAGES})
              </span>
            </Label>

            {/* Existing and New Images */}
            <AnimatePresence>
              {(existingImages.length > 0 || newImagePreviews.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex gap-2 flex-wrap"
                >
                  {/* Existing Images */}
                  {existingImages.map((img) => (
                    <motion.div
                      key={img.mediaId}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="relative size-20 rounded-lg overflow-hidden bg-muted group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt="Review photo"
                        className="size-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeExistingImage(img.mediaId)}
                        disabled={isPending}
                        className="absolute top-1 right-1 size-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 disabled:opacity-50"
                      >
                        <X className="size-3.5" />
                      </button>
                    </motion.div>
                  ))}

                  {/* New Image Previews */}
                  {newImagePreviews.map((url, index) => (
                    <motion.div
                      key={`new-${index}`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="relative size-20 rounded-lg overflow-hidden bg-muted group ring-2 ring-primary/30"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`New photo ${index + 1}`}
                        className="size-full object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-primary/80 text-primary-foreground text-[10px] text-center py-0.5">
                        New
                      </div>
                      <button
                        type="button"
                        onClick={() => removeNewImage(index)}
                        disabled={isPending}
                        className="absolute top-1 right-1 size-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 disabled:opacity-50"
                      >
                        <X className="size-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Upload button */}
            {totalImageCount < MAX_IMAGES && (
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
                  {totalImageCount > 0 ? "Add More Photos" : "Add Photos"}
                </Button>
                <p className="text-xs text-muted-foreground mt-1.5">
                  JPEG, PNG up to 5MB each
                </p>
              </div>
            )}
          </div>

          {/* Note about editing */}
          <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
            After editing, your review will be marked as &quot;edited&quot; so
            other customers know it was updated.
          </p>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleClose(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                type="submit"
                disabled={isPending || rating === 0}
                className="min-w-30"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </motion.div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
