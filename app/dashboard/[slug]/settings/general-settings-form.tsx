"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, Check, Info } from "lucide-react";
import {
  generalSettingsSchema,
  currencyOptions,
  type GeneralSettingsInput,
} from "@/lib/validations/stores";
import { CURRENCIES } from "@/lib/currency/currencies";
import { updateGeneralSettings } from "@/lib/actions/stores";
import { ZodError } from "zod";

interface GeneralSettingsFormProps {
  storeId: string;
  initialData: {
    name: string;
    tagline: string;
    description: string;
    contactEmail: string;
    contactPhone: string;
    currency: string;
    afnExchangeRate: string;
    slug: string;
  };
}

export function GeneralSettingsForm({
  storeId,
  initialData,
}: GeneralSettingsFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof GeneralSettingsInput, string>>
  >({});
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState({
    name: initialData.name,
    tagline: initialData.tagline,
    description: initialData.description,
    contactEmail: initialData.contactEmail,
    contactPhone: initialData.contactPhone,
    currency: initialData.currency,
    afnExchangeRate: initialData.afnExchangeRate,
  });

  // Track previous initialData to sync state when props change (e.g., after router.refresh())
  const [prevInitialData, setPrevInitialData] = useState(initialData);
  if (prevInitialData !== initialData) {
    setPrevInitialData(initialData);
    setFormData({
      name: initialData.name,
      tagline: initialData.tagline,
      description: initialData.description,
      contactEmail: initialData.contactEmail,
      contactPhone: initialData.contactPhone,
      currency: initialData.currency,
      afnExchangeRate: initialData.afnExchangeRate,
    });
  }

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
        generalSettingsSchema.parse(formData);
      } catch (err) {
        if (err instanceof ZodError) {
          const errors: Partial<Record<keyof GeneralSettingsInput, string>> =
            {};
          err.issues.forEach((issue) => {
            if (issue.path[0]) {
              errors[issue.path[0] as keyof GeneralSettingsInput] =
                issue.message;
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
        submitData.append(key, value);
      });

      const result = await updateGeneralSettings(storeId, submitData);

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
      toast.success("Settings saved successfully!");
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
          <AlertDescription>Settings saved successfully!</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
          <CardDescription>Basic information about your store.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel htmlFor="name">Store name</FieldLabel>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => updateField("name", e.target.value)}
              disabled={isPending}
              aria-invalid={!!fieldErrors.name}
            />
            <FieldError>{fieldErrors.name}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="tagline">Tagline</FieldLabel>
            <Input
              id="tagline"
              value={formData.tagline}
              onChange={(e) => updateField("tagline", e.target.value)}
              placeholder="A short catchy phrase"
              disabled={isPending}
              aria-invalid={!!fieldErrors.tagline}
            />
            <FieldDescription>
              A brief description that appears below your store name
            </FieldDescription>
            <FieldError>{fieldErrors.tagline}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="description">Description</FieldLabel>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Tell customers about your store..."
              rows={4}
              disabled={isPending}
            />
            <FieldDescription>
              A longer description for your store&apos;s about page
            </FieldDescription>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Store URL</CardTitle>
          <CardDescription>Your store&apos;s public address.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            <span className="text-sm text-muted-foreground">
              kakamalem.com/store/
            </span>
            <span className="text-sm font-medium">{initialData.slug}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Store URL cannot be changed after creation
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>How customers can reach you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel htmlFor="contactEmail">Contact email</FieldLabel>
            <Input
              id="contactEmail"
              type="email"
              value={formData.contactEmail}
              onChange={(e) => updateField("contactEmail", e.target.value)}
              placeholder="contact@example.com"
              disabled={isPending}
              aria-invalid={!!fieldErrors.contactEmail}
            />
            <FieldError>{fieldErrors.contactEmail}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="contactPhone">Contact phone</FieldLabel>
            <PhoneInput
              id="contactPhone"
              value={formData.contactPhone}
              onChange={(value) => updateField("contactPhone", value || "")}
              disabled={isPending}
              aria-invalid={!!fieldErrors.contactPhone}
            />
            <FieldError>{fieldErrors.contactPhone}</FieldError>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Currency</CardTitle>
          <CardDescription>
            The currency all your prices are shown in, across your storefront,
            dashboard, and receipts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel htmlFor="currency">Store currency</FieldLabel>
            <Select
              value={formData.currency}
              onValueChange={(value) => updateField("currency", value)}
              disabled={isPending}
            >
              <SelectTrigger id="currency" className="w-full sm:w-72">
                <SelectValue placeholder="Select a currency" />
              </SelectTrigger>
              <SelectContent>
                {currencyOptions.map((code) => {
                  const meta = CURRENCIES[code];
                  return (
                    <SelectItem key={code} value={code}>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-6 text-muted-foreground">
                          {meta.symbol}
                        </span>
                        <span>
                          {meta.label}{" "}
                          <span className="text-muted-foreground">
                            ({code})
                          </span>
                        </span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <FieldError>{fieldErrors.currency}</FieldError>
          </Field>

          {formData.currency !== initialData.currency && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Changing the currency only changes the symbol shown — it does
                not convert your existing product prices. Review your prices
                after switching.
              </AlertDescription>
            </Alert>
          )}

          {formData.currency !== "AFN" && (
            <Field>
              <FieldLabel htmlFor="afnExchangeRate">
                Afghani exchange rate
              </FieldLabel>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  1 {formData.currency} =
                </span>
                <Input
                  id="afnExchangeRate"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className="w-40"
                  value={formData.afnExchangeRate}
                  onChange={(e) =>
                    updateField("afnExchangeRate", e.target.value)
                  }
                  placeholder="70"
                  disabled={isPending}
                  aria-invalid={!!fieldErrors.afnExchangeRate}
                />
                <span className="text-sm text-muted-foreground">AFN</span>
              </div>
              <FieldDescription>
                HesabPay can only charge customers in Afghani, so orders priced
                in {formData.currency} are converted at this rate. Leave it
                empty to hide card payment and accept cash on delivery only.
              </FieldDescription>
              <FieldError>{fieldErrors.afnExchangeRate}</FieldError>
            </Field>
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
