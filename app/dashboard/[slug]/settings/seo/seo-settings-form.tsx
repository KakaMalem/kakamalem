"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, Check, Upload, X } from "lucide-react";
import {
  seoSettingsSchema,
  type SeoSettingsInput,
} from "@/lib/validations/stores";
import { updateSeoSettings } from "@/lib/actions/stores";
import { toast } from "sonner";
import {
  MAX_SIZES,
  formatFileSize,
  UPLOAD_ERROR_MESSAGES,
} from "@/lib/config/file-validation";

// Image state type - can be existing URL or staged file
type ImageState = {
  url: string;
  file?: File;
  isStaged?: boolean;
};

// Upload progress state
type UploadProgress = {
  isUploading: boolean;
  progress: number;
};

interface SeoSettingsFormProps {
  storeId: string;
  storeName: string;
  initialData: {
    metaTitle: string;
    metaDescription: string;
    ogImageUrl: string;
  };
}

export function SeoSettingsForm({
  storeId,
  storeName,
  initialData,
}: SeoSettingsFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof SeoSettingsInput, string>>
  >({});
  const [isPending, startTransition] = useTransition();

  const [metaTitle, setMetaTitle] = useState(initialData.metaTitle);
  const [metaDescription, setMetaDescription] = useState(
    initialData.metaDescription
  );

  // OG Image state - can be existing URL or staged file
  const [ogImage, setOgImage] = useState<ImageState | null>(() =>
    initialData.ogImageUrl
      ? { url: initialData.ogImageUrl, isStaged: false }
      : null
  );

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    isUploading: false,
    progress: 0,
  });

  // Track previous initialData to sync state when props change (e.g., after router.refresh())
  const [prevInitialData, setPrevInitialData] = useState(initialData);
  if (prevInitialData !== initialData) {
    setPrevInitialData(initialData);
    setMetaTitle(initialData.metaTitle);
    setMetaDescription(initialData.metaDescription);
    setOgImage(
      initialData.ogImageUrl
        ? { url: initialData.ogImageUrl, isStaged: false }
        : null
    );
  }

  // Helper to upload a file with progress tracking
  const uploadFileWithProgress = useCallback(
    (
      file: File,
      folder: string,
      onProgress: (progress: number) => void
    ): Promise<string | null> => {
      return new Promise((resolve) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("tenantId", storeId);
        formData.append("folder", folder);

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            // Cap at 95% to leave room for server processing
            const progress = Math.min(
              95,
              Math.round((e.loaded / e.total) * 95)
            );
            onProgress(progress);
          }
        });

        xhr.addEventListener("load", () => {
          // Server responded - set to 100%
          onProgress(100);

          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText) as {
                success: boolean;
                file?: { url: string };
                error?: string;
              };
              if (response.success && response.file?.url) {
                resolve(response.file.url);
              } else {
                toast.error(
                  response.error || UPLOAD_ERROR_MESSAGES.unknownError
                );
                resolve(null);
              }
            } catch {
              toast.error(UPLOAD_ERROR_MESSAGES.serverError);
              resolve(null);
            }
          } else {
            if (xhr.status === 413) {
              toast.error(
                UPLOAD_ERROR_MESSAGES.fileTooLarge(
                  formatFileSize(MAX_SIZES["og-images"])
                )
              );
            } else if (xhr.status === 401) {
              toast.error("You must be logged in to upload files");
            } else if (xhr.status === 403) {
              toast.error("You don't have permission to upload to this store");
            } else {
              toast.error(UPLOAD_ERROR_MESSAGES.serverError);
            }
            resolve(null);
          }
        });

        xhr.addEventListener("error", () => {
          toast.error(UPLOAD_ERROR_MESSAGES.networkError);
          resolve(null);
        });

        xhr.addEventListener("timeout", () => {
          toast.error("Upload timed out. Please try again.");
          resolve(null);
        });

        xhr.timeout = 120000;
        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });
    },
    [storeId]
  );

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (ogImage?.isStaged && ogImage.url) URL.revokeObjectURL(ogImage.url);
    };
  }, [ogImage]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(UPLOAD_ERROR_MESSAGES.invalidType);
      return;
    }

    // Use a reasonable max size for OG images (5MB)
    const maxSize = MAX_SIZES["og-images"] || 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(UPLOAD_ERROR_MESSAGES.fileTooLarge(formatFileSize(maxSize)));
      return;
    }

    // Cleanup previous staged URL
    if (ogImage?.isStaged && ogImage.url) {
      URL.revokeObjectURL(ogImage.url);
    }

    const previewUrl = URL.createObjectURL(file);
    setOgImage({ url: previewUrl, file, isStaged: true });
    setSuccess(false);
    e.target.value = "";
  };

  const removeImage = () => {
    if (ogImage?.isStaged && ogImage.url) {
      URL.revokeObjectURL(ogImage.url);
    }
    setOgImage(null);
    setSuccess(false);
  };

  // Scroll to first error field when fieldErrors change
  useEffect(() => {
    const errorFields = Object.keys(fieldErrors);
    if (errorFields.length === 0) return;

    const firstErrorField = errorFields[0];
    const element = document.getElementById(firstErrorField);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => element.focus(), 300);
    }
  }, [fieldErrors]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError(null);
    setFieldErrors({});
    setSuccess(false);

    try {
      // Get staged file that needs uploading
      const ogImageFile =
        ogImage?.isStaged && ogImage.file ? ogImage.file : null;
      let uploadedOgImageUrl = ogImage && !ogImage.isStaged ? ogImage.url : "";

      // Upload OG image with progress if needed
      if (ogImageFile) {
        setUploadProgress({ isUploading: true, progress: 0 });
        const url = await uploadFileWithProgress(
          ogImageFile,
          "og-images",
          (progress) => {
            setUploadProgress({ isUploading: true, progress });
          }
        );
        setUploadProgress({ isUploading: false, progress: 0 });

        if (!url) {
          return; // Error already shown by uploadFileWithProgress
        }
        uploadedOgImageUrl = url;

        // Update state with new URL
        if (ogImage?.isStaged && ogImage.url) URL.revokeObjectURL(ogImage.url);
        setOgImage({ url: uploadedOgImageUrl, isStaged: false });
      }

      // Now save the settings with URL
      startTransition(async () => {
        try {
          const formData = {
            metaTitle,
            metaDescription,
            ogImageUrl: uploadedOgImageUrl,
          };

          // Client-side validation
          const validation = seoSettingsSchema.safeParse(formData);
          if (!validation.success) {
            const errors: Partial<Record<keyof SeoSettingsInput, string>> = {};
            validation.error.issues.forEach((issue) => {
              if (issue.path[0]) {
                errors[issue.path[0] as keyof SeoSettingsInput] = issue.message;
              }
            });
            setFieldErrors(errors);
            toast.error(validation.error.issues[0].message);
            return;
          }

          // Create FormData for server action
          const submitData = new FormData();
          submitData.append("metaTitle", metaTitle);
          submitData.append("metaDescription", metaDescription);
          submitData.append("ogImageUrl", uploadedOgImageUrl);

          const result = await updateSeoSettings(storeId, submitData);

          if (result.error) {
            if (result.error.field) {
              setFieldErrors({ [result.error.field]: result.error.message });
              toast.error(result.error.message);
            } else {
              setError(result.error.message);
              toast.error(result.error.message);
            }
            return;
          }

          setSuccess(true);
          toast.success("SEO settings saved!");
          // Refresh to update all components with fresh server data
          router.refresh();
        } catch {
          toast.error("Failed to save settings. Please try again.");
        }
      });
    } catch {
      setUploadProgress({ isUploading: false, progress: 0 });
      toast.error("Something went wrong. Please try again.");
    }
  }

  const metaTitleLength = metaTitle.length;
  const metaDescriptionLength = metaDescription.length;
  const isUploading = uploadProgress.isUploading;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <Check className="h-4 w-4" />
          <AlertDescription>SEO settings saved successfully!</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Search Engine Optimization</CardTitle>
          <CardDescription>
            Optimize how your store appears in search results and social media
            shares.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel htmlFor="metaTitle">Meta Title</FieldLabel>
            <Input
              id="metaTitle"
              value={metaTitle}
              onChange={(e) => {
                setMetaTitle(e.target.value);
                setSuccess(false);
              }}
              placeholder={storeName}
              disabled={isPending || isUploading}
              aria-invalid={!!fieldErrors.metaTitle}
              maxLength={60}
            />
            <div className="flex items-center justify-between">
              <FieldDescription>
                Appears as the title in search results
              </FieldDescription>
              <span
                className={`text-xs ${
                  metaTitleLength > 60
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {metaTitleLength}/60
              </span>
            </div>
            <FieldError>{fieldErrors.metaTitle}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="metaDescription">Meta Description</FieldLabel>
            <Textarea
              id="metaDescription"
              value={metaDescription}
              onChange={(e) => {
                setMetaDescription(e.target.value);
                setSuccess(false);
              }}
              placeholder="A brief description of your store..."
              disabled={isPending || isUploading}
              rows={3}
              maxLength={160}
            />
            <div className="flex items-center justify-between">
              <FieldDescription>
                Appears below the title in search results
              </FieldDescription>
              <span
                className={`text-xs ${
                  metaDescriptionLength > 160
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {metaDescriptionLength}/160
              </span>
            </div>
            <FieldError>{fieldErrors.metaDescription}</FieldError>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social Sharing Image</CardTitle>
          <CardDescription>
            This image appears when your store is shared on WhatsApp, Facebook,
            and other platforms. Recommended size: 1200x630px.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ogImage ? (
            <div className="relative aspect-1200/630 max-w-md mx-auto">
              <Image
                src={ogImage.url}
                alt="Social sharing preview"
                fill
                className="rounded-lg object-cover border"
                unoptimized={ogImage.isStaged}
              />
              {ogImage.isStaged && (
                <span className="absolute -top-2 -left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                  New
                </span>
              )}
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm"
                disabled={isPending || isUploading}
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <label className="flex w-full items-center justify-center h-40 border-2 border-dashed rounded-lg bg-muted/50 cursor-pointer hover:border-muted-foreground/50 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="sr-only"
                disabled={isPending || isUploading}
              />
              <div className="text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Click to upload OG image
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  1200x630px recommended, PNG/JPG up to 5MB
                </p>
              </div>
            </label>
          )}
          {uploadProgress.isUploading && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Uploading image...
                </span>
                <span className="text-muted-foreground">
                  {uploadProgress.progress}%
                </span>
              </div>
              <Progress value={uploadProgress.progress} className="h-2" />
            </div>
          )}
          {ogImage && !uploadProgress.isUploading && (
            <div className="flex justify-center mt-3">
              <label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="sr-only"
                  disabled={isPending || isUploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  disabled={isPending || isUploading}
                >
                  <span className="cursor-pointer">
                    <Upload className="mr-2 size-4" />
                    Change Image
                  </span>
                </Button>
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Search Preview</CardTitle>
          <CardDescription>
            How your store may appear in search results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 border rounded-lg bg-white">
            <p className="text-blue-600 text-lg hover:underline cursor-pointer">
              {metaTitle || storeName}
            </p>
            <p className="text-green-700 text-sm">kakamalem.com/store/...</p>
            <p className="text-gray-600 text-sm mt-1">
              {metaDescription || "No description provided"}
            </p>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-6">
          <Button type="submit" disabled={isPending || isUploading}>
            {(isPending || isUploading) && <Spinner className="mr-2" />}
            {isUploading
              ? "Uploading..."
              : isPending
                ? "Saving..."
                : "Save changes"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
