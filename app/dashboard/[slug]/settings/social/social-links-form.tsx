"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, Check } from "lucide-react";
import {
  socialLinksSchema,
  type SocialLinksInput,
  preferredContactMethodOptions,
  preferredContactMethodLabels,
  preferredContactMethodDescriptions,
  type PreferredContactMethod,
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
    preferredContactMethod: PreferredContactMethod;
    showWhatsAppButton: boolean;
  };
}

export function SocialLinksForm({
  storeId,
  initialData,
}: SocialLinksFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof SocialLinksInput, string>>
  >({});
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState(initialData);

  // Sync state when props change (e.g., after router.refresh())
  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

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

  const updateField = (
    field: keyof typeof formData,
    value: string | boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]:
        field === "showWhatsAppButton"
          ? value === "true" || value === true
          : value,
    }));
    setSuccess(false);
    if (fieldErrors[field as keyof typeof fieldErrors]) {
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
          toast.error(err.issues[0].message);
          return;
        }
      }

      // Create FormData for server action
      const submitData = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        submitData.append(key, String(value));
      });

      const result = await updateSocialLinks(storeId, submitData);

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
      toast.success("Social links saved successfully!");
      // Refresh to update all components with fresh server data
      router.refresh();
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
            <PhoneInput
              value={formData.whatsapp}
              onChange={(value) => updateField("whatsapp", value || "")}
              defaultCountry="AF"
              disabled={isPending}
              aria-invalid={!!fieldErrors.whatsapp}
            />
            <FieldDescription>
              Enter your WhatsApp number with country code
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
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp Settings</CardTitle>
          <CardDescription>
            Configure how customers contact you via WhatsApp. These settings
            affect how phone numbers are displayed on your storefront.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field>
            <FieldLabel>Phone Number Link Behavior</FieldLabel>
            <FieldDescription className="mb-3">
              When customers click your phone number, where should it open?
            </FieldDescription>
            <RadioGroup
              value={formData.preferredContactMethod}
              onValueChange={(value) =>
                updateField("preferredContactMethod", value)
              }
              disabled={isPending}
              className="space-y-3"
            >
              {preferredContactMethodOptions.map((option) => (
                <div key={option} className="flex items-start space-x-3">
                  <RadioGroupItem value={option} id={`contact-${option}`} />
                  <div className="space-y-0.5">
                    <Label
                      htmlFor={`contact-${option}`}
                      className="font-medium cursor-pointer"
                    >
                      {preferredContactMethodLabels[option]}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {preferredContactMethodDescriptions[option]}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </Field>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="showWhatsAppButton" className="font-medium">
                Floating WhatsApp Button
              </Label>
              <p className="text-sm text-muted-foreground">
                Show a floating WhatsApp button on all store pages for quick
                contact
              </p>
            </div>
            <Switch
              id="showWhatsAppButton"
              checked={formData.showWhatsAppButton}
              onCheckedChange={(checked) =>
                updateField("showWhatsAppButton", String(checked))
              }
              disabled={isPending || !formData.whatsapp}
            />
          </div>
          {!formData.whatsapp && (
            <p className="text-sm text-amber-600">
              Enter a WhatsApp number above to enable WhatsApp features
            </p>
          )}
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
