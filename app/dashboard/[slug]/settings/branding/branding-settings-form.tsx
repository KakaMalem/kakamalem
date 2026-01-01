"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, Check, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  brandingSettingsSchema,
  type BrandingSettingsInput,
} from "@/lib/validations/stores";
import { updateBrandingSettings } from "@/lib/supabase/stores";
import { ZodError } from "zod";

interface BrandingSettingsFormProps {
  storeId: string;
  initialData: {
    logoUrl: string;
    faviconUrl: string;
    headerDisplay: "logo_only" | "name_only" | "logo_and_name";
  };
}

export function BrandingSettingsForm({
  storeId,
  initialData,
}: BrandingSettingsFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof BrandingSettingsInput, string>>
  >({});
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState({
    logoUrl: initialData.logoUrl,
    faviconUrl: initialData.faviconUrl,
    headerDisplay: initialData.headerDisplay,
  });

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSuccess(false);
    if (fieldErrors[field as keyof BrandingSettingsInput]) {
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
        brandingSettingsSchema.parse(formData);
      } catch (err) {
        if (err instanceof ZodError) {
          const errors: Partial<Record<keyof BrandingSettingsInput, string>> =
            {};
          err.issues.forEach((issue) => {
            if (issue.path[0]) {
              errors[issue.path[0] as keyof BrandingSettingsInput] =
                issue.message;
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

      const result = await updateBrandingSettings(storeId, submitData);

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
          <AlertDescription>
            Branding settings saved successfully!
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>
            Upload your store logo. Recommended size: 512x512px.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 border-2 border-dashed rounded-lg bg-muted/50">
            <div className="text-center">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Image upload coming soon
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG up to 2MB
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Favicon</CardTitle>
          <CardDescription>
            The small icon shown in browser tabs. Recommended size: 32x32px.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-20 border-2 border-dashed rounded-lg bg-muted/50">
            <div className="text-center">
              <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">
                Favicon upload coming soon
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Header Display</CardTitle>
          <CardDescription>
            Choose how your store name and logo appear in the header.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={formData.headerDisplay}
            onValueChange={(value) => updateField("headerDisplay", value)}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            disabled={isPending}
          >
            <Label
              htmlFor="hd_name_only"
              className={cn(
                "flex flex-col items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors",
                formData.headerDisplay === "name_only"
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-muted-foreground/50"
              )}
            >
              <RadioGroupItem
                value="name_only"
                id="hd_name_only"
                className="sr-only"
              />
              <div className="h-10 flex items-center">
                <span className="font-semibold">Store Name</span>
              </div>
              <span className="text-sm text-muted-foreground">Text only</span>
            </Label>

            <Label
              htmlFor="hd_logo_only"
              className={cn(
                "flex flex-col items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors",
                formData.headerDisplay === "logo_only"
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-muted-foreground/50"
              )}
            >
              <RadioGroupItem
                value="logo_only"
                id="hd_logo_only"
                className="sr-only"
              />
              <div className="h-10 flex items-center">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <span className="text-lg font-bold text-muted-foreground">
                    S
                  </span>
                </div>
              </div>
              <span className="text-sm text-muted-foreground">Logo only</span>
            </Label>

            <Label
              htmlFor="hd_logo_and_name"
              className={cn(
                "flex flex-col items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors",
                formData.headerDisplay === "logo_and_name"
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-muted-foreground/50"
              )}
            >
              <RadioGroupItem
                value="logo_and_name"
                id="hd_logo_and_name"
                className="sr-only"
              />
              <div className="h-10 flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                  <span className="text-sm font-bold text-muted-foreground">
                    S
                  </span>
                </div>
                <span className="font-semibold text-sm">Store</span>
              </div>
              <span className="text-sm text-muted-foreground">Logo + Name</span>
            </Label>
          </RadioGroup>
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
