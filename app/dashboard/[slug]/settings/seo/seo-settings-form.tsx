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
import { AlertCircle, Check, ImageIcon, X } from "lucide-react";
import {
  seoSettingsSchema,
  type SeoSettingsInput,
} from "@/lib/validations/stores";
import { updateSeoSettings } from "@/lib/actions/stores";
import { toast } from "sonner";
import {
  UnifiedMediaSelector,
  type MediaSelection,
} from "@/components/dashboard/media/unified-media-selector";

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
  const [ogImageUrl, setOgImageUrl] = useState(initialData.ogImageUrl);
  const [mediaSelectorOpen, setMediaSelectorOpen] = useState(false);

  const handleMediaSelect = (media: MediaSelection | null) => {
    setOgImageUrl(media?.url || "");
    setSuccess(false);
  };

  const removeImage = () => {
    setOgImageUrl("");
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

    startTransition(async () => {
      setError(null);
      setFieldErrors({});
      setSuccess(false);

      const formData = {
        metaTitle,
        metaDescription,
        ogImageUrl,
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
      submitData.append("ogImageUrl", ogImageUrl);

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
    });
  }

  const metaTitleLength = metaTitle.length;
  const metaDescriptionLength = metaDescription.length;

  return (
    <>
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
            <AlertDescription>
              SEO settings saved successfully!
            </AlertDescription>
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
              <FieldLabel htmlFor="metaDescription">
                Meta Description
              </FieldLabel>
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
            {ogImageUrl ? (
              <div className="relative aspect-1200/630 max-w-md mx-auto">
                <Image
                  src={ogImageUrl}
                  alt="Social sharing preview"
                  fill
                  className="rounded-lg object-cover border"
                />
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
              <button
                type="button"
                onClick={() => setMediaSelectorOpen(true)}
                className="flex w-full items-center justify-center h-40 border-2 border-dashed rounded-lg bg-muted/50 cursor-pointer hover:border-muted-foreground/50 transition-colors"
                disabled={isPending}
              >
                <div className="text-center">
                  <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Click to select OG image from media library
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    1200x630px recommended
                  </p>
                </div>
              </button>
            )}
            {ogImageUrl && (
              <div className="flex justify-center mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMediaSelectorOpen(true)}
                  disabled={isPending}
                >
                  <ImageIcon className="mr-2 size-4" />
                  Change Image
                </Button>
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

      <UnifiedMediaSelector
        tenantId={storeId}
        open={mediaSelectorOpen}
        onOpenChange={setMediaSelectorOpen}
        multiple={false}
        onSelect={handleMediaSelect}
        title="Select OG Image"
      />
    </>
  );
}
