"use client";

import { useState, useTransition, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Store,
  Palette,
  Settings,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createStoreSchema,
  generateSlug,
  type CreateStoreInput,
} from "@/lib/validations/stores";
import {
  createStoreWithLogo,
  checkSlugAvailability,
} from "@/lib/actions/stores";
import { ZodError } from "zod";
import { toast } from "sonner";
import {
  MAX_SIZES,
  formatFileSize,
  UPLOAD_ERROR_MESSAGES,
} from "@/lib/config/file-validation";

// Logo state type - staged file for preview
type LogoState = {
  url: string;
  file: File;
};

interface CreateStoreFormProps {
  userEmail: string;
}

const steps = [
  { id: 1, title: "Basic Info", icon: Store },
  { id: 2, title: "Branding", icon: Palette },
  { id: 3, title: "Contact", icon: Settings },
];

export function CreateStoreForm({ userEmail }: CreateStoreFormProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof CreateStoreInput, string>>
  >({});
  const [isPending, startTransition] = useTransition();
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const slugCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Logo state - staged file for preview
  const [logo, setLogo] = useState<LogoState | null>(null);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (logo?.url) URL.revokeObjectURL(logo.url);
    };
  }, [logo]);

  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    slug: string;
    tagline: string;
    logoUrl: string;
    headerDisplay: "logo_only" | "name_only" | "logo_and_name";
    contactEmail: string;
    contactPhone: string;
    currency: "AFN" | "USD";
  }>({
    name: "",
    slug: "",
    tagline: "",
    logoUrl: "",
    headerDisplay: "name_only",
    contactEmail: userEmail,
    contactPhone: "",
    currency: "AFN",
  });

  // Check slug availability with debounce
  const checkSlug = useCallback(async (slug: string) => {
    // Clear any existing timer
    if (slugCheckTimer.current) {
      clearTimeout(slugCheckTimer.current);
    }

    if (slug.length < 3) {
      setSlugAvailable(null);
      setCheckingSlug(false);
      return;
    }

    setCheckingSlug(true);
    slugCheckTimer.current = setTimeout(async () => {
      const available = await checkSlugAvailability(slug);
      setSlugAvailable(available);
      setCheckingSlug(false);
    }, 500);
  }, []);

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    // Auto-generate slug when name changes (if slug hasn't been manually edited)
    if (field === "name" && !slugManuallyEdited) {
      const generatedSlug = generateSlug(value);
      setFormData((prev) => ({ ...prev, slug: generatedSlug }));
      checkSlug(generatedSlug);
    }
    // Check slug availability when slug field changes
    if (field === "slug") {
      setSlugManuallyEdited(true);
      checkSlug(value);
    }
  };

  // Handle logo upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(UPLOAD_ERROR_MESSAGES.invalidType);
      return;
    }

    const maxSize = MAX_SIZES.logos;
    if (file.size > maxSize) {
      toast.error(UPLOAD_ERROR_MESSAGES.fileTooLarge(formatFileSize(maxSize)));
      return;
    }

    // Cleanup previous URL
    if (logo?.url) {
      URL.revokeObjectURL(logo.url);
    }

    const previewUrl = URL.createObjectURL(file);
    setLogo({ url: previewUrl, file });
    e.target.value = "";
  };

  const removeLogo = () => {
    if (logo?.url) {
      URL.revokeObjectURL(logo.url);
    }
    setLogo(null);
    // Reset to name_only if a logo-dependent option was selected
    if (
      formData.headerDisplay === "logo_only" ||
      formData.headerDisplay === "logo_and_name"
    ) {
      setFormData((prev) => ({ ...prev, headerDisplay: "name_only" }));
    }
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

  const validateStep = (step: number): boolean => {
    const errors: Partial<Record<keyof CreateStoreInput, string>> = {};

    if (step === 1) {
      if (!formData.name || formData.name.length < 2) {
        errors.name = "Store name must be at least 2 characters";
      }
      if (!formData.slug || formData.slug.length < 3) {
        errors.slug = "Store URL must be at least 3 characters";
      } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formData.slug)) {
        errors.slug =
          "Store URL can only contain lowercase letters, numbers, and hyphens";
      } else if (slugAvailable === false) {
        errors.slug = "This store URL is already taken";
      }
    }

    if (step === 3) {
      if (
        formData.contactEmail &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)
      ) {
        errors.contactEmail = "Please enter a valid email address";
      }
    }

    setFieldErrors(errors);

    // Show toast for first error
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      toast.error(errors[errorKeys[0] as keyof typeof errors]);
    }

    return errorKeys.length === 0;
  };

  const nextStep = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Only allow submission on the final step
    if (currentStep !== 3) return;

    if (!validateStep(currentStep)) return;

    startTransition(async () => {
      setError(null);

      // Full validation
      try {
        createStoreSchema.parse(formData);
      } catch (err) {
        if (err instanceof ZodError) {
          const errors: Partial<Record<keyof CreateStoreInput, string>> = {};
          err.issues.forEach((issue) => {
            if (issue.path[0]) {
              errors[issue.path[0] as keyof CreateStoreInput] = issue.message;
            }
          });
          setFieldErrors(errors);
          toast.error(err.issues[0].message);
          return;
        }
      }

      // Use the new createStoreWithLogo action
      const result = await createStoreWithLogo(formData, logo?.file || null);

      if (result.error) {
        // Check for connection/network errors
        const errorMessage = result.error.message.toLowerCase();
        if (
          errorMessage.includes("network") ||
          errorMessage.includes("fetch") ||
          errorMessage.includes("connection")
        ) {
          toast.error(UPLOAD_ERROR_MESSAGES.networkError);
          setError(UPLOAD_ERROR_MESSAGES.networkError);
        } else if (result.error.field) {
          setFieldErrors({ [result.error.field]: result.error.message });
          toast.error(result.error.message);
        } else {
          setError(result.error.message);
          toast.error(result.error.message);
        }
        return;
      }

      // Success - redirect to the new store's dashboard
      router.push(`/dashboard/${formData.slug}`);
    });
  }

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                currentStep === step.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : currentStep > step.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {currentStep > step.id ? (
                <Check className="h-5 w-5" />
              ) : (
                <step.icon className="h-5 w-5" />
              )}
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-12 h-0.5 mx-2",
                  currentStep > step.id
                    ? "bg-primary"
                    : "bg-muted-foreground/30"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Title */}
      <div className="text-center">
        <h2 className="text-lg font-semibold">
          Step {currentStep}: {steps[currentStep - 1].title}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <Field>
              <FieldLabel htmlFor="name">Store name</FieldLabel>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                onInput={(e) =>
                  updateField("name", (e.target as HTMLInputElement).value)
                }
                placeholder="My Awesome Store"
                disabled={isPending}
                aria-invalid={!!fieldErrors.name}
              />
              <FieldError>{fieldErrors.name}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="slug">Store URL</FieldLabel>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  kakamalem.com/store/
                </span>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) =>
                    updateField("slug", e.target.value.toLowerCase())
                  }
                  placeholder="my-store"
                  disabled={isPending}
                  aria-invalid={!!fieldErrors.slug}
                  className="flex-1"
                />
              </div>
              {checkingSlug ? (
                <FieldDescription>Checking availability...</FieldDescription>
              ) : slugAvailable === true ? (
                <FieldDescription className="text-green-600">
                  This URL is available
                </FieldDescription>
              ) : slugAvailable === false ? (
                <FieldError>This URL is already taken</FieldError>
              ) : formData.name && !formData.slug ? (
                <FieldDescription className="text-amber-600">
                  Please enter a custom URL (letters a-z, numbers, and hyphens
                  only)
                </FieldDescription>
              ) : fieldErrors.slug ? (
                <FieldError>{fieldErrors.slug}</FieldError>
              ) : (
                <FieldDescription>
                  Only lowercase letters (a-z), numbers, and hyphens allowed
                </FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="tagline">Tagline (optional)</FieldLabel>
              <Input
                id="tagline"
                value={formData.tagline}
                onChange={(e) => updateField("tagline", e.target.value)}
                placeholder="A short catchy phrase for your store"
                disabled={isPending}
                aria-invalid={!!fieldErrors.tagline}
              />
              <FieldDescription>
                A short phrase that describes your store
              </FieldDescription>
              <FieldError>{fieldErrors.tagline}</FieldError>
            </Field>
          </div>
        )}

        {/* Step 2: Branding */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <Field>
              <FieldLabel>Store logo (optional)</FieldLabel>
              {logo ? (
                <div className="relative w-32 h-32 mx-auto">
                  <Image
                    src={logo.url}
                    alt="Store logo preview"
                    fill
                    className="rounded-lg object-contain border bg-muted/30"
                    unoptimized
                  />
                  <span className="absolute -top-2 -left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                    New
                  </span>
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm"
                    disabled={isPending}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg bg-muted/50 cursor-pointer hover:border-muted-foreground/50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="sr-only"
                    disabled={isPending}
                  />
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload logo
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG up to 2MB
                  </p>
                </label>
              )}
              {logo && (
                <div className="flex justify-center mt-3">
                  <label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
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
              <FieldDescription className="text-center mt-2">
                This logo will appear in your store header
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Header display</FieldLabel>
              <RadioGroup
                value={formData.headerDisplay}
                onValueChange={(value) => updateField("headerDisplay", value)}
                className="grid grid-cols-3 gap-4 mt-2"
              >
                <Label
                  htmlFor="name_only"
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-colors",
                    formData.headerDisplay === "name_only"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/50"
                  )}
                >
                  <RadioGroupItem
                    value="name_only"
                    id="name_only"
                    className="sr-only"
                  />
                  <div className="h-8 flex items-center">
                    <span className="font-semibold text-sm">Store Name</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Text only
                  </span>
                </Label>

                <Label
                  htmlFor="logo_only"
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors",
                    !logo && "cursor-not-allowed",
                    logo && "cursor-pointer",
                    formData.headerDisplay === "logo_only"
                      ? "border-primary bg-primary/5"
                      : logo
                        ? "border-muted hover:border-muted-foreground/50"
                        : "border-muted"
                  )}
                >
                  <RadioGroupItem
                    value="logo_only"
                    id="logo_only"
                    className="sr-only"
                    disabled={!logo}
                  />
                  <div className="h-8 flex items-center">
                    <div
                      className={cn(
                        "w-8 h-8 rounded bg-muted flex items-center justify-center",
                        !logo && "opacity-50"
                      )}
                    >
                      <span className="text-sm font-bold text-foreground">
                        S
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-xs",
                      !logo
                        ? "text-muted-foreground/50"
                        : "text-muted-foreground"
                    )}
                  >
                    Logo only
                  </span>
                </Label>

                <Label
                  htmlFor="logo_and_name"
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors",
                    !logo && "cursor-not-allowed",
                    logo && "cursor-pointer",
                    formData.headerDisplay === "logo_and_name"
                      ? "border-primary bg-primary/5"
                      : logo
                        ? "border-muted hover:border-muted-foreground/50"
                        : "border-muted"
                  )}
                >
                  <RadioGroupItem
                    value="logo_and_name"
                    id="logo_and_name"
                    className="sr-only"
                    disabled={!logo}
                  />
                  <div className="h-8 flex items-center gap-2">
                    <div
                      className={cn(
                        "w-6 h-6 rounded bg-muted flex items-center justify-center",
                        !logo && "opacity-50"
                      )}
                    >
                      <span className="text-xs font-bold text-foreground">
                        S
                      </span>
                    </div>
                    <span
                      className={cn(
                        "font-semibold text-xs",
                        !logo && "text-foreground/50"
                      )}
                    >
                      Name
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-xs",
                      !logo
                        ? "text-muted-foreground/50"
                        : "text-muted-foreground"
                    )}
                  >
                    Both
                  </span>
                </Label>
              </RadioGroup>
              <FieldDescription className="mt-2">
                {logo
                  ? "How your store name and logo appear in the header"
                  : "Upload a logo to enable logo display options"}
              </FieldDescription>
            </Field>
          </div>
        )}

        {/* Step 3: Contact & Currency */}
        {currentStep === 3 && (
          <div className="space-y-4">
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
              <FieldDescription>
                Customers will use this to contact you
              </FieldDescription>
              <FieldError>{fieldErrors.contactEmail}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="contactPhone">
                Contact phone (optional)
              </FieldLabel>
              <PhoneInput
                id="contactPhone"
                value={formData.contactPhone}
                onChange={(value) => updateField("contactPhone", value || "")}
                defaultCountry="AF"
                disabled={isPending}
                aria-invalid={!!fieldErrors.contactPhone}
              />
              <FieldError>{fieldErrors.contactPhone}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="currency">Store currency</FieldLabel>
              <Select
                value={formData.currency}
                onValueChange={(value) => updateField("currency", value)}
                disabled={isPending}
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AFN">AFN - Afghan Afghani</SelectItem>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                The currency used for pricing products
              </FieldDescription>
            </Field>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={isPending}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {currentStep < 3 ? (
            <Button
              type="button"
              onClick={(e) => nextStep(e)}
              disabled={isPending}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner className="mr-2" />}
              {isPending ? "Creating store..." : "Create store"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
