"use client";

import { useState, useTransition, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, ArrowLeft, ArrowRight, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { ZodError } from "zod";

import {
  StepIndicator,
  StepTitle,
  StorePreviewCard,
  StepStoreType,
  StepBasicInfo,
  StepBranding,
  StepContact,
} from "@/components/dashboard/wizard";
import {
  createStoreSchema,
  generateSlug,
  type CreateStoreInput,
} from "@/lib/validations/stores";
import {
  createStoreWithLogo,
  checkSlugAvailability,
} from "@/lib/actions/stores";
import {
  MAX_SIZES,
  formatFileSize,
  UPLOAD_ERROR_MESSAGES,
} from "@/lib/config/file-validation";
import type { StoreMode } from "@/lib/config/onboarding";

// Logo state type - staged file for preview
type LogoState = {
  url: string;
  file: File;
};

interface CreateStoreFormProps {
  userEmail: string;
  userPhone: string;
}

// Animation variants for step transitions
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 50 : -50,
    opacity: 0,
  }),
};

export function CreateStoreForm({
  userEmail,
  userPhone,
}: CreateStoreFormProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);
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
    storeMode: StoreMode;
    name: string;
    slug: string;
    tagline: string;
    logoUrl: string;
    headerDisplay: "logo_only" | "name_only" | "logo_and_name";
    contactEmail: string;
    contactPhone: string;
    currency: string;
    // Location
    storeLocationLat: number | null;
    storeLocationLng: number | null;
    storeLocationCity: string;
    storeLocationAccuracy: number | null;
    storeLocationSource: "gps" | "manual" | null;
    storeLocationPlusCode: string;
  }>({
    storeMode: "online_only",
    name: "",
    slug: "",
    tagline: "",
    logoUrl: "",
    headerDisplay: "name_only",
    contactEmail: userEmail,
    contactPhone: userPhone,
    currency: "USD",
    // Location defaults
    storeLocationLat: null,
    storeLocationLng: null,
    storeLocationCity: "",
    storeLocationAccuracy: null,
    storeLocationSource: null,
    storeLocationPlusCode: "",
  });

  // Check slug availability with debounce
  const checkSlug = useCallback(async (slug: string) => {
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

  // Field update handlers
  const updateStoreMode = (mode: StoreMode) => {
    setFormData((prev) => ({ ...prev, storeMode: mode }));
  };

  const updateName = (value: string) => {
    setFormData((prev) => ({ ...prev, name: value }));
    if (fieldErrors.name) {
      setFieldErrors((prev) => ({ ...prev, name: undefined }));
    }
    // Auto-generate slug when name changes (if slug hasn't been manually edited)
    if (!slugManuallyEdited) {
      const generatedSlug = generateSlug(value);
      setFormData((prev) => ({ ...prev, slug: generatedSlug }));
      checkSlug(generatedSlug);
    }
  };

  const updateSlug = (value: string) => {
    setFormData((prev) => ({ ...prev, slug: value }));
    setSlugManuallyEdited(true);
    if (fieldErrors.slug) {
      setFieldErrors((prev) => ({ ...prev, slug: undefined }));
    }
    checkSlug(value);
  };

  const updateTagline = (value: string) => {
    setFormData((prev) => ({ ...prev, tagline: value }));
    if (fieldErrors.tagline) {
      setFieldErrors((prev) => ({ ...prev, tagline: undefined }));
    }
  };

  const updateHeaderDisplay = (
    value: "logo_only" | "name_only" | "logo_and_name"
  ) => {
    setFormData((prev) => ({ ...prev, headerDisplay: value }));
  };

  const updateContactEmail = (value: string) => {
    setFormData((prev) => ({ ...prev, contactEmail: value }));
    if (fieldErrors.contactEmail) {
      setFieldErrors((prev) => ({ ...prev, contactEmail: undefined }));
    }
  };

  const updateContactPhone = (value: string) => {
    setFormData((prev) => ({ ...prev, contactPhone: value }));
    if (fieldErrors.contactPhone) {
      setFieldErrors((prev) => ({ ...prev, contactPhone: undefined }));
    }
  };

  const updateCurrency = (value: string) => {
    setFormData((prev) => ({ ...prev, currency: value }));
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
      } else if (
        !/^[\p{Ll}\p{Lo}\p{N}]+(?:-[\p{Ll}\p{Lo}\p{N}]+)*$/u.test(formData.slug)
      ) {
        errors.slug =
          "Store URL can only contain letters, numbers, and hyphens";
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
      setDirection(1);
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => {
    setDirection(-1);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const skipStep = () => {
    setDirection(1);
    setCurrentStep((prev) => Math.min(prev + 1, 3));
  };

  // Steps 2 (Branding), and 3 (Contact) are optional
  const isOptionalStep = currentStep >= 2 && currentStep <= 3;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Only allow submission on the final step (Step 3: Contact)
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

      // Package data + logo file into FormData for reliable file transport
      const fd = new FormData();
      fd.append("values", JSON.stringify(formData));
      if (logo?.file) {
        fd.append("logo", logo.file);
      }

      const result = await createStoreWithLogo(fd);

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

      // Success - redirect to welcome page to guide user to add their first product
      toast.success("Store created successfully!");
      router.push(`/dashboard/${formData.slug}/welcome`);
    });
  }

  // Determine if we should show the preview card (steps 1-3)
  const showPreview = currentStep >= 1;

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />

      {/* Step Title */}
      <StepTitle currentStep={currentStep} />

      {/* Main Content Area */}
      <div
        className={
          showPreview ? "grid grid-cols-1 lg:grid-cols-2 gap-8 items-start" : ""
        }
      >
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Animated Step Content */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              {/* Step 0: Store Type */}
              {currentStep === 0 && (
                <StepStoreType
                  value={formData.storeMode}
                  onChange={updateStoreMode}
                  disabled={isPending}
                />
              )}

              {/* Step 1: Basic Info */}
              {currentStep === 1 && (
                <StepBasicInfo
                  name={formData.name}
                  slug={formData.slug}
                  tagline={formData.tagline}
                  onNameChange={updateName}
                  onSlugChange={updateSlug}
                  onTaglineChange={updateTagline}
                  fieldErrors={fieldErrors}
                  checkingSlug={checkingSlug}
                  slugAvailable={slugAvailable}
                  disabled={isPending}
                />
              )}

              {/* Step 2: Branding */}
              {currentStep === 2 && (
                <StepBranding
                  logoUrl={logo?.url || null}
                  headerDisplay={formData.headerDisplay}
                  onLogoUpload={handleLogoUpload}
                  onLogoRemove={removeLogo}
                  onHeaderDisplayChange={updateHeaderDisplay}
                  disabled={isPending}
                />
              )}

              {/* Step 3: Contact */}
              {currentStep === 3 && (
                <StepContact
                  contactEmail={formData.contactEmail}
                  contactPhone={formData.contactPhone}
                  currency={formData.currency}
                  onContactEmailChange={updateContactEmail}
                  onContactPhoneChange={updateContactPhone}
                  onCurrencyChange={updateCurrency}
                  fieldErrors={fieldErrors}
                  disabled={isPending}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-4">
            {currentStep > 0 ? (
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

            <div className="flex items-center gap-2">
              {/* Skip button for optional steps (2, 3) - but not on final step */}
              {isOptionalStep && currentStep < 3 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={skipStep}
                  disabled={isPending}
                >
                  Skip
                  <SkipForward className="h-4 w-4 ml-2" />
                </Button>
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
          </div>
        </form>

        {/* Live Preview Card - shown on steps 1-3 */}
        {showPreview && (
          <div className="hidden lg:block">
            <StorePreviewCard
              name={formData.name}
              tagline={formData.tagline}
              logoUrl={logo?.url || null}
              headerDisplay={formData.headerDisplay}
              storeMode={formData.storeMode}
            />
          </div>
        )}
      </div>
    </div>
  );
}
