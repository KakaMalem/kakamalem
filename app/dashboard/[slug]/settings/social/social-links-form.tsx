"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { AlertCircle, Check } from "lucide-react";
import {
  socialLinksSchema,
  type SocialLinksInput,
} from "@/lib/validations/stores";
import { updateSocialLinks } from "@/lib/actions/stores";
import { ZodError } from "zod";

interface SocialLinksFormProps {
  storeId: string;
  initialData: {
    facebook: string;
    instagram: string;
    twitter: string;
    whatsapp: string;
    telegram: string;
    tiktok: string;
    youtube: string;
  };
}

export function SocialLinksForm({
  storeId,
  initialData,
}: SocialLinksFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof SocialLinksInput, string>>
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
        socialLinksSchema.parse(formData);
      } catch (err) {
        if (err instanceof ZodError) {
          const errors: Partial<Record<keyof SocialLinksInput, string>> = {};
          err.issues.forEach((issue) => {
            if (issue.path[0]) {
              errors[issue.path[0] as keyof SocialLinksInput] = issue.message;
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

      const result = await updateSocialLinks(storeId, submitData);

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
          <AlertDescription>Social links saved successfully!</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Social Media Links</CardTitle>
          <CardDescription>
            Connect your store to your social media accounts. These links will
            be displayed on your storefront.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel htmlFor="facebook">Facebook</FieldLabel>
            <Input
              id="facebook"
              type="url"
              value={formData.facebook}
              onChange={(e) => updateField("facebook", e.target.value)}
              placeholder="https://facebook.com/yourpage"
              disabled={isPending}
              aria-invalid={!!fieldErrors.facebook}
            />
            <FieldError>{fieldErrors.facebook}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="instagram">Instagram</FieldLabel>
            <Input
              id="instagram"
              type="url"
              value={formData.instagram}
              onChange={(e) => updateField("instagram", e.target.value)}
              placeholder="https://instagram.com/yourprofile"
              disabled={isPending}
              aria-invalid={!!fieldErrors.instagram}
            />
            <FieldError>{fieldErrors.instagram}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="twitter">Twitter / X</FieldLabel>
            <Input
              id="twitter"
              type="url"
              value={formData.twitter}
              onChange={(e) => updateField("twitter", e.target.value)}
              placeholder="https://x.com/yourhandle"
              disabled={isPending}
              aria-invalid={!!fieldErrors.twitter}
            />
            <FieldError>{fieldErrors.twitter}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="whatsapp">WhatsApp</FieldLabel>
            <Input
              id="whatsapp"
              type="tel"
              value={formData.whatsapp}
              onChange={(e) => updateField("whatsapp", e.target.value)}
              placeholder="+93700000000"
              disabled={isPending}
              aria-invalid={!!fieldErrors.whatsapp}
            />
            <FieldDescription>
              Enter your WhatsApp number with country code (e.g., +93 for
              Afghanistan)
            </FieldDescription>
            <FieldError>{fieldErrors.whatsapp}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="telegram">Telegram</FieldLabel>
            <Input
              id="telegram"
              type="url"
              value={formData.telegram}
              onChange={(e) => updateField("telegram", e.target.value)}
              placeholder="https://t.me/yourchannel"
              disabled={isPending}
              aria-invalid={!!fieldErrors.telegram}
            />
            <FieldError>{fieldErrors.telegram}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="tiktok">TikTok</FieldLabel>
            <Input
              id="tiktok"
              type="url"
              value={formData.tiktok}
              onChange={(e) => updateField("tiktok", e.target.value)}
              placeholder="https://tiktok.com/@yourprofile"
              disabled={isPending}
              aria-invalid={!!fieldErrors.tiktok}
            />
            <FieldError>{fieldErrors.tiktok}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="youtube">YouTube</FieldLabel>
            <Input
              id="youtube"
              type="url"
              value={formData.youtube}
              onChange={(e) => updateField("youtube", e.target.value)}
              placeholder="https://youtube.com/@yourchannel"
              disabled={isPending}
              aria-invalid={!!fieldErrors.youtube}
            />
            <FieldError>{fieldErrors.youtube}</FieldError>
          </Field>
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
