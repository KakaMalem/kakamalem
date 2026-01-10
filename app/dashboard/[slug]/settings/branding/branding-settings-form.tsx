"use client";

import { useState, useTransition, useEffect } from "react";
import Image from "next/image";
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
import { AlertCircle, Check, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { brandingSettingsSchema } from "@/lib/validations/stores";
import { updateBrandingSettingsWithImages } from "@/lib/actions/stores";
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
  const [isPending, startTransition] = useTransition();

  const [headerDisplay, setHeaderDisplay] = useState(initialData.headerDisplay);

  // Logo image state
  const [logo, setLogo] = useState<ImageState | null>(() =>
    initialData.logoUrl ? { url: initialData.logoUrl, isStaged: false } : null
  );

  // Favicon image state
  const [favicon, setFavicon] = useState<ImageState | null>(() =>
    initialData.faviconUrl
      ? { url: initialData.faviconUrl, isStaged: false }
      : null
  );

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (logo?.isStaged && logo.url) URL.revokeObjectURL(logo.url);
      if (favicon?.isStaged && favicon.url) URL.revokeObjectURL(favicon.url);
    };
  }, [logo, favicon]);

  const handleImageUpload = (
    type: "logo" | "favicon",
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(UPLOAD_ERROR_MESSAGES.invalidType);
      return;
    }

    const maxSize = type === "logo" ? MAX_SIZES.logos : MAX_SIZES.favicons;
    if (file.size > maxSize) {
      toast.error(UPLOAD_ERROR_MESSAGES.fileTooLarge(formatFileSize(maxSize)));
      return;
    }

    const setter = type === "logo" ? setLogo : setFavicon;
    const current = type === "logo" ? logo : favicon;

    // Cleanup previous staged URL
    if (current?.isStaged && current.url) {
      URL.revokeObjectURL(current.url);
    }

    const previewUrl = URL.createObjectURL(file);
    setter({ url: previewUrl, file, isStaged: true });
    setSuccess(false);
    e.target.value = "";
  };

  const removeImage = (type: "logo" | "favicon") => {
    const setter = type === "logo" ? setLogo : setFavicon;
    const current = type === "logo" ? logo : favicon;

    if (current?.isStaged && current.url) {
      URL.revokeObjectURL(current.url);
    }
    setter(null);
    setSuccess(false);

    // Reset to name_only if removing logo and a logo-dependent option was selected
    if (
      type === "logo" &&
      (headerDisplay === "logo_only" || headerDisplay === "logo_and_name")
    ) {
      setHeaderDisplay("name_only");
    }
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    startTransition(async () => {
      setError(null);
      setSuccess(false);

      const formData = {
        logoUrl: logo && !logo.isStaged ? logo.url : "",
        faviconUrl: favicon && !favicon.isStaged ? favicon.url : "",
        headerDisplay,
      };

      // Client-side validation
      const validation = brandingSettingsSchema.safeParse(formData);
      if (!validation.success) {
        const firstError = validation.error.issues[0]?.message;
        toast.error(firstError || "Please check the form for errors");
        return;
      }

      // Get staged files
      const logoFile = logo?.isStaged && logo.file ? logo.file : null;
      const faviconFile =
        favicon?.isStaged && favicon.file ? favicon.file : null;

      const result = await updateBrandingSettingsWithImages(
        storeId,
        formData,
        logoFile,
        faviconFile
      );

      if (result.error) {
        // Check for connection/network errors
        const errorMessage = result.error.message.toLowerCase();
        if (
          errorMessage.includes("network") ||
          errorMessage.includes("fetch") ||
          errorMessage.includes("connection")
        ) {
          toast.error(UPLOAD_ERROR_MESSAGES.networkError);
        } else {
          toast.error(result.error.message);
        }
        return;
      }

      // Update local state with new URLs if images were uploaded
      if (result.logoUrl) {
        if (logo?.isStaged && logo.url) URL.revokeObjectURL(logo.url);
        setLogo({ url: result.logoUrl, isStaged: false });
      }
      if (result.faviconUrl) {
        if (favicon?.isStaged && favicon.url) URL.revokeObjectURL(favicon.url);
        setFavicon({ url: result.faviconUrl, isStaged: false });
      }

      setSuccess(true);
      toast.success("Branding settings saved!");
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
          {logo ? (
            <div className="relative w-32 h-32 mx-auto">
              <Image
                src={logo.url}
                alt="Store logo"
                fill
                className="rounded-lg object-contain border bg-muted/30"
                unoptimized={logo.isStaged}
              />
              {logo.isStaged && (
                <span className="absolute -top-2 -left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                  New
                </span>
              )}
              <button
                type="button"
                onClick={() => removeImage("logo")}
                className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm"
                disabled={isPending}
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center h-32 border-2 border-dashed rounded-lg bg-muted/50 cursor-pointer hover:border-muted-foreground/50 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload("logo", e)}
                className="sr-only"
                disabled={isPending}
              />
              <div className="text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Click to upload logo
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG up to 2MB
                </p>
              </div>
            </label>
          )}
          {logo && (
            <div className="flex justify-center mt-3">
              <label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload("logo", e)}
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
                    Change Logo
                  </span>
                </Button>
              </label>
            </div>
          )}
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
          {favicon ? (
            <div className="relative w-16 h-16 mx-auto">
              <Image
                src={favicon.url}
                alt="Store favicon"
                fill
                className="rounded object-contain border bg-muted/30"
                unoptimized={favicon.isStaged}
              />
              {favicon.isStaged && (
                <span className="absolute -top-2 -left-2 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                  New
                </span>
              )}
              <button
                type="button"
                onClick={() => removeImage("favicon")}
                className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm"
                disabled={isPending}
              >
                <X className="size-3" />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center h-20 border-2 border-dashed rounded-lg bg-muted/50 cursor-pointer hover:border-muted-foreground/50 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload("favicon", e)}
                className="sr-only"
                disabled={isPending}
              />
              <div className="text-center">
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">
                  Click to upload favicon (PNG, ICO up to 512KB)
                </p>
              </div>
            </label>
          )}
          {favicon && (
            <div className="flex justify-center mt-3">
              <label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload("favicon", e)}
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
                    Change Favicon
                  </span>
                </Button>
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Header Display</CardTitle>
          <CardDescription>
            {logo
              ? "Choose how your store name and logo appear in the header."
              : "Upload a logo above to enable logo display options."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={headerDisplay}
            onValueChange={(value) => {
              setHeaderDisplay(
                value as "logo_only" | "name_only" | "logo_and_name"
              );
              setSuccess(false);
            }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            disabled={isPending}
          >
            <Label
              htmlFor="hd_name_only"
              className={cn(
                "flex flex-col items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors",
                headerDisplay === "name_only"
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
                "flex flex-col items-center gap-3 rounded-lg border-2 p-4 transition-colors",
                !logo && "cursor-not-allowed",
                logo && "cursor-pointer",
                headerDisplay === "logo_only"
                  ? "border-primary bg-primary/5"
                  : logo
                    ? "border-muted hover:border-muted-foreground/50"
                    : "border-muted"
              )}
            >
              <RadioGroupItem
                value="logo_only"
                id="hd_logo_only"
                className="sr-only"
                disabled={!logo}
              />
              <div className="h-10 flex items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg bg-muted flex items-center justify-center",
                    !logo && "opacity-50"
                  )}
                >
                  <span className="text-lg font-bold text-foreground">S</span>
                </div>
              </div>
              <span
                className={cn(
                  "text-sm",
                  !logo ? "text-muted-foreground/50" : "text-muted-foreground"
                )}
              >
                Logo only
              </span>
            </Label>

            <Label
              htmlFor="hd_logo_and_name"
              className={cn(
                "flex flex-col items-center gap-3 rounded-lg border-2 p-4 transition-colors",
                !logo && "cursor-not-allowed",
                logo && "cursor-pointer",
                headerDisplay === "logo_and_name"
                  ? "border-primary bg-primary/5"
                  : logo
                    ? "border-muted hover:border-muted-foreground/50"
                    : "border-muted"
              )}
            >
              <RadioGroupItem
                value="logo_and_name"
                id="hd_logo_and_name"
                className="sr-only"
                disabled={!logo}
              />
              <div className="h-10 flex items-center gap-2">
                <div
                  className={cn(
                    "w-8 h-8 rounded bg-muted flex items-center justify-center",
                    !logo && "opacity-50"
                  )}
                >
                  <span className="text-sm font-bold text-foreground">S</span>
                </div>
                <span
                  className={cn(
                    "font-semibold text-sm",
                    !logo && "text-foreground/50"
                  )}
                >
                  Store
                </span>
              </div>
              <span
                className={cn(
                  "text-sm",
                  !logo ? "text-muted-foreground/50" : "text-muted-foreground"
                )}
              >
                Logo + Name
              </span>
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
