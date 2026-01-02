"use client";

import { useState, useTransition, useEffect } from "react";
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
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, Check, Upload, X } from "lucide-react";
import {
  seoSettingsSchema,
  type SeoSettingsInput,
} from "@/lib/validations/stores";
import { updateSeoSettingsWithImage } from "@/lib/supabase/stores";
import { toast } from "sonner";

// Image state type
type ImageState = {
  url: string;
  file?: File;
  isStaged?: boolean;
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

  // OG Image state
  const [ogImage, setOgImage] = useState<ImageState | null>(() =>
    initialData.ogImageUrl
      ? { url: initialData.ogImageUrl, isStaged: false }
      : null
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
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    startTransition(async () => {
      setError(null);
      setFieldErrors({});
      setSuccess(false);

      const formData = {
        metaTitle,
        metaDescription,
        ogImageUrl: ogImage && !ogImage.isStaged ? ogImage.url : "",
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
        return;
      }

      // Get staged file
      const ogImageFile =
        ogImage?.isStaged && ogImage.file ? ogImage.file : null;

      const result = await updateSeoSettingsWithImage(
        storeId,
        formData,
        ogImageFile
      );

      if (result.error) {
        if (result.error.field) {
          setFieldErrors({ [result.error.field]: result.error.message });
        } else {
          setError(result.error.message);
        }
        return;
      }

      // Update local state with new URL if image was uploaded
      if (result.ogImageUrl) {
        if (ogImage?.isStaged && ogImage.url) URL.revokeObjectURL(ogImage.url);
        setOgImage({ url: result.ogImageUrl, isStaged: false });
      }

      setSuccess(true);
      toast.success("SEO settings saved!");
    });
  }

  const metaTitleLength = metaTitle.length;
  const metaDescriptionLength = metaDescription.length;

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
              disabled={isPending}
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
              disabled={isPending}
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
            This image appears when your store is shared on social media.
            Recommended size: 1200x630px.
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
                <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                  New
                </span>
              )}
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm"
                disabled={isPending}
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center h-40 border-2 border-dashed rounded-lg bg-muted/50 cursor-pointer hover:border-muted-foreground/50 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="sr-only"
                disabled={isPending}
              />
              <div className="text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Click to upload OG image
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG up to 2MB (1200x630px recommended)
                </p>
              </div>
            </label>
          )}
          {ogImage && (
            <div className="flex justify-center mt-3">
              <label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="sr-only"
                  disabled={isPending}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  disabled={isPending}
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
          <Button type="submit" disabled={isPending}>
            {isPending && <Spinner className="mr-2" />}
            {isPending ? "Saving..." : "Save changes"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
