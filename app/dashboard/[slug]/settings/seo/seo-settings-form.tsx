"use client";

import { useState, useTransition } from "react";
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
import { AlertCircle, Check, Upload } from "lucide-react";
import {
  seoSettingsSchema,
  type SeoSettingsInput,
} from "@/lib/validations/stores";
import { updateSeoSettings } from "@/lib/supabase/stores";
import { ZodError } from "zod";

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

  const [formData, setFormData] = useState(initialData);

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSuccess(false);
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    startTransition(async () => {
      setError(null);
      setFieldErrors({});
      setSuccess(false);

      // Client-side validation
      try {
        seoSettingsSchema.parse(formData);
      } catch (err) {
        if (err instanceof ZodError) {
          const errors: Partial<Record<keyof SeoSettingsInput, string>> = {};
          err.issues.forEach((issue) => {
            if (issue.path[0]) {
              errors[issue.path[0] as keyof SeoSettingsInput] = issue.message;
            }
          });
          setFieldErrors(errors);
          return;
        }
      }

      // Create FormData for server action
      const submitData = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        submitData.append(key, value);
      });

      const result = await updateSeoSettings(storeId, submitData);

      if (result.error) {
        if (result.error.field) {
          setFieldErrors({ [result.error.field]: result.error.message });
        } else {
          setError(result.error.message);
        }
        return;
      }

      setSuccess(true);
    });
  }

  const metaTitleLength = formData.metaTitle.length;
  const metaDescriptionLength = formData.metaDescription.length;

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
              value={formData.metaTitle}
              onChange={(e) => updateField("metaTitle", e.target.value)}
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
              value={formData.metaDescription}
              onChange={(e) => updateField("metaDescription", e.target.value)}
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
          <div className="flex items-center justify-center h-40 border-2 border-dashed rounded-lg bg-muted/50">
            <div className="text-center">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                OG image upload coming soon
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG up to 2MB (1200x630px recommended)
              </p>
            </div>
          </div>
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
              {formData.metaTitle || storeName}
            </p>
            <p className="text-green-700 text-sm">kakamalem.com/store/...</p>
            <p className="text-gray-600 text-sm mt-1">
              {formData.metaDescription || "No description provided"}
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
