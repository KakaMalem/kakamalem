"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import {
  affiliateApplicationSchema,
  type AffiliateApplicationInput,
} from "@/lib/validations/platform-affiliates";
import {
  submitAffiliateApplication,
  checkSlugAvailability,
} from "@/lib/actions/platform-affiliates";
import { AFFILIATE_CONFIG } from "@/lib/affiliate/constants";
import { useDebouncedCallback } from "use-debounce";
import { slugifyAscii } from "@/lib/utils/slug";

interface AffiliateApplicationFormProps {
  userEmail: string;
}

type FieldErrors = Partial<Record<keyof AffiliateApplicationInput, string>>;

export function AffiliateApplicationForm({
  userEmail,
}: AffiliateApplicationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});

  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [bio, setBio] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [applicationNotes, setApplicationNotes] = useState("");

  // Social links
  const [instagram, setInstagram] = useState("");
  const [youtube, setYoutube] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [facebook, setFacebook] = useState("");

  // Slug availability state
  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "available" | "unavailable"
  >("idle");
  const [slugSuggestion, setSlugSuggestion] = useState<string | null>(null);

  // Debounced slug check
  const checkSlug = useDebouncedCallback(async (value: string) => {
    if (value.length < AFFILIATE_CONFIG.minSlugLength) {
      setSlugStatus("idle");
      return;
    }

    setSlugStatus("checking");
    const result = await checkSlugAvailability(value);

    if (result.data?.available) {
      setSlugStatus("available");
      setSlugSuggestion(null);
    } else {
      setSlugStatus("unavailable");
      setSlugSuggestion(result.data?.suggestion || null);
    }
  }, 500);

  // Handle display name change and auto-generate slug
  const handleDisplayNameChange = useCallback(
    (value: string) => {
      setDisplayName(value);
      if (errors.displayName) {
        setErrors((prev) => ({ ...prev, displayName: undefined }));
      }

      // Auto-generate slug if not manually edited
      if (!isSlugManuallyEdited) {
        const generatedSlug = slugifyAscii(value).slice(
          0,
          AFFILIATE_CONFIG.maxSlugLength
        );
        setSlug(generatedSlug);
        if (generatedSlug.length >= AFFILIATE_CONFIG.minSlugLength) {
          setSlugStatus("idle");
          checkSlug(generatedSlug);
        } else {
          setSlugStatus("idle");
        }
      }
    },
    [isSlugManuallyEdited, errors.displayName, checkSlug]
  );

  const handleSlugChange = (value: string) => {
    // Only allow lowercase letters, numbers, and hyphens
    const sanitized = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/--+/g, "-");
    setSlug(sanitized);
    setIsSlugManuallyEdited(true);
    setSlugStatus("idle");
    if (errors.slug) {
      setErrors((prev) => ({ ...prev, slug: undefined }));
    }
    checkSlug(sanitized);
  };

  const resetSlug = () => {
    setIsSlugManuallyEdited(false);
    const generatedSlug = slugifyAscii(displayName).slice(
      0,
      AFFILIATE_CONFIG.maxSlugLength
    );
    setSlug(generatedSlug);
    if (generatedSlug.length >= AFFILIATE_CONFIG.minSlugLength) {
      setSlugStatus("idle");
      checkSlug(generatedSlug);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const formData: AffiliateApplicationInput = {
      displayName,
      slug,
      bio: bio || undefined,
      websiteUrl: websiteUrl || undefined,
      socialLinks:
        instagram || youtube || tiktok || facebook
          ? {
              instagram: instagram || undefined,
              youtube: youtube || undefined,
              tiktok: tiktok || undefined,
              facebook: facebook || undefined,
            }
          : undefined,
      applicationNotes,
    };

    // Client-side validation
    const result = affiliateApplicationSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof AffiliateApplicationInput;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    // Check slug availability before submitting
    if (slugStatus !== "available") {
      setErrors({ slug: "Please choose an available vanity URL" });
      return;
    }

    startTransition(async () => {
      const response = await submitAffiliateApplication(formData);

      if (!response.success) {
        if (response.error?.field) {
          setErrors({ [response.error.field]: response.error.message });
        } else {
          toast.error(
            response.error?.message || "Failed to create affiliate account"
          );
        }
        return;
      }

      toast.success("Welcome to the affiliate program! Your account is ready.");
      router.push("/affiliate/dashboard");
    });
  };

  const useSuggestion = useCallback(() => {
    if (slugSuggestion) {
      setSlug(slugSuggestion);
      setSlugStatus("available");
      setSlugSuggestion(null);
    }
  }, [slugSuggestion]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Display Name */}
      <Field>
        <FieldLabel required>Display Name</FieldLabel>
        <Input
          value={displayName}
          onChange={(e) => handleDisplayNameChange(e.target.value)}
          placeholder="Your name or brand name"
          disabled={isPending}
          maxLength={100}
          aria-invalid={!!errors.displayName}
        />
        <FieldError error={errors.displayName} />
        <p className="text-xs text-muted-foreground mt-1">
          This will be shown publicly on your affiliate profile.
        </p>
      </Field>

      {/* Vanity URL (Slug) */}
      <Field>
        <div className="flex items-center justify-between mb-2">
          <FieldLabel required className="mb-0">
            Vanity URL
          </FieldLabel>
          {isSlugManuallyEdited ? (
            <Badge variant="secondary" className="text-xs">
              Custom
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              Auto-generated
            </Badge>
          )}
        </div>

        {/* URL Preview */}
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground mb-2">
          <span className="break-all">
            kakamalem.com/
            <span className="font-medium text-foreground">
              {slug || "yourname"}
            </span>
          </span>
        </div>

        {/* Input with reset button */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="yourname"
              disabled={isPending}
              maxLength={AFFILIATE_CONFIG.maxSlugLength}
              aria-invalid={!!errors.slug || slugStatus === "unavailable"}
              className={
                slugStatus === "available" && slug && !errors.slug
                  ? "border-green-500 focus-visible:ring-green-500 pr-8"
                  : slugStatus === "unavailable" || errors.slug
                    ? "border-destructive focus-visible:ring-destructive pr-8"
                    : "pr-8"
              }
            />
            {slug.length >= AFFILIATE_CONFIG.minSlugLength && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {slugStatus === "checking" && (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                )}
                {slugStatus === "available" && (
                  <CheckCircle2 className="size-4 text-green-600" />
                )}
                {slugStatus === "unavailable" && (
                  <XCircle className="size-4 text-red-600" />
                )}
              </div>
            )}
          </div>

          {/* Reset button - only show if manually edited */}
          {isSlugManuallyEdited && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={resetSlug}
              disabled={isPending}
              title="Reset to auto-generated slug"
            >
              <RefreshCw className="size-4" />
            </Button>
          )}
        </div>

        <FieldError error={errors.slug} />
        {slugStatus === "unavailable" && slugSuggestion && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              Try:{" "}
              <button
                type="button"
                onClick={useSuggestion}
                className="text-primary hover:underline font-medium"
              >
                {slugSuggestion}
              </button>
            </span>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {isSlugManuallyEdited
            ? "You've customized this URL. Click the reset button to auto-generate from your display name."
            : "Automatically generated from your display name. Edit to customize."}
        </p>
      </Field>

      {/* Bio */}
      <Field>
        <FieldLabel>
          Bio{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </FieldLabel>
        <Textarea
          value={bio}
          onChange={(e) => {
            setBio(e.target.value);
            if (errors.bio) {
              setErrors((prev) => ({ ...prev, bio: undefined }));
            }
          }}
          placeholder="Tell us a bit about yourself..."
          disabled={isPending}
          rows={3}
          maxLength={1000}
          aria-invalid={!!errors.bio}
        />
        <FieldError error={errors.bio} />
      </Field>

      {/* Website */}
      <Field>
        <FieldLabel>
          Website{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </FieldLabel>
        <Input
          type="url"
          value={websiteUrl}
          onChange={(e) => {
            setWebsiteUrl(e.target.value);
            if (errors.websiteUrl) {
              setErrors((prev) => ({ ...prev, websiteUrl: undefined }));
            }
          }}
          placeholder="https://yourwebsite.com"
          disabled={isPending}
          aria-invalid={!!errors.websiteUrl}
        />
        <FieldError error={errors.websiteUrl} />
      </Field>

      {/* Social Links */}
      <div className="space-y-4">
        <FieldLabel>
          Social Links{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </FieldLabel>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field>
            <Input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="Instagram username"
              disabled={isPending}
            />
          </Field>
          <Field>
            <Input
              value={youtube}
              onChange={(e) => setYoutube(e.target.value)}
              placeholder="YouTube channel"
              disabled={isPending}
            />
          </Field>
          <Field>
            <Input
              value={tiktok}
              onChange={(e) => setTiktok(e.target.value)}
              placeholder="TikTok username"
              disabled={isPending}
            />
          </Field>
          <Field>
            <Input
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
              placeholder="Facebook page"
              disabled={isPending}
            />
          </Field>
        </div>
      </div>

      {/* Application Notes */}
      <Field>
        <FieldLabel required>How do you plan to promote Kaka Malem?</FieldLabel>
        <Textarea
          value={applicationNotes}
          onChange={(e) => {
            setApplicationNotes(e.target.value);
            if (errors.applicationNotes) {
              setErrors((prev) => ({ ...prev, applicationNotes: undefined }));
            }
          }}
          placeholder="Tell us about your audience, marketing channels, and how you'll promote Kaka Malem to potential store owners..."
          disabled={isPending}
          rows={4}
          maxLength={2000}
          aria-invalid={!!errors.applicationNotes}
        />
        <FieldError error={errors.applicationNotes} />
        <p className="text-xs text-muted-foreground mt-1">
          Minimum 20 characters. Be specific about your audience and promotion
          strategy.
        </p>
      </Field>

      {/* Info Box */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex gap-3">
          <AlertCircle className="size-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p>
              By signing up, you agree to our affiliate program{" "}
              <a href="/terms" className="text-primary hover:underline">
                terms and conditions
              </a>
              . Your account will be instantly activated and linked to{" "}
              <span className="font-medium text-foreground">{userEmail}</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isPending || slugStatus === "checking"}
        className="w-full"
        size="lg"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Creating Account...
          </>
        ) : (
          "Create Affiliate Account"
        )}
      </Button>
    </form>
  );
}
