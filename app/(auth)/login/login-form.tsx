"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { resendVerificationEmail } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, Mail } from "lucide-react";
import { OAuthButton } from "@/components/auth/oauth-button";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { ZodError } from "zod";
import { handleFormErrors } from "@/lib/utils/form-errors";

// Map field names to DOM element IDs for scroll-to-error
const FIELD_ID_MAP: Record<string, string> = {
  email: "email",
  password: "password",
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof LoginInput, string>>
  >({});
  const [success, setSuccess] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function handleResendVerification() {
    if (!loginEmail || isResending || resendCooldown > 0) return;
    setIsResending(true);
    try {
      await resendVerificationEmail(loginEmail);
      toast.success("Verification email sent! Check your inbox.");
      setResendCooldown(60);
    } catch {
      toast.error("Failed to resend. Please try again.");
    } finally {
      setIsResending(false);
    }
  }

  // Scroll to first error field when fieldErrors change
  useEffect(() => {
    const errorFields = Object.keys(fieldErrors);
    if (errorFields.length === 0) return;

    const firstErrorField = errorFields[0];
    const elementId = FIELD_ID_MAP[firstErrorField];

    if (elementId) {
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => element.focus(), 300);
      }
    }
  }, [fieldErrors]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    setError(null);
    setFieldErrors({});
    setIsPending(true);

    // Client-side validation
    const formValues = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    try {
      loginSchema.parse(formValues);
    } catch (err) {
      if (err instanceof ZodError) {
        const errors: Partial<Record<keyof LoginInput, string>> = {};
        err.issues.forEach((issue) => {
          if (issue.path[0]) {
            errors[issue.path[0] as keyof LoginInput] = issue.message;
          }
        });
        setFieldErrors(errors);
        handleFormErrors(errors, FIELD_ID_MAP);
        setIsPending(false);
        return;
      }
    }

    try {
      // Use Better Auth client SDK - this properly sets cookies
      const result = await authClient.signIn.email({
        email: formValues.email,
        password: formValues.password,
      });

      if (result.error) {
        const errorMessage =
          result.error.message || "Invalid email or password";
        // Detect email verification errors
        const isVerificationError =
          errorMessage.toLowerCase().includes("verif") ||
          result.error.code === "EMAIL_NOT_VERIFIED";
        if (isVerificationError) {
          setLoginEmail(formValues.email);
          setNeedsVerification(true);
        }
        setError(errorMessage);
        toast.error(errorMessage);
        setIsPending(false);
        return;
      }

      // Show success state briefly, then do a hard navigation
      // Hard navigation ensures cookies are properly read on the server
      setSuccess(true);
      await new Promise((resolve) => setTimeout(resolve, 500));
      window.location.href = redirect;
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred");
      toast.error("An unexpected error occurred");
      setIsPending(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100">
          <Mail className="h-6 w-6 text-emerald-600" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold">Welcome back!</h1>
          <p className="text-sm text-muted-foreground">
            Redirecting you to your dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your account</p>
      </div>

      {/* OAuth first — lowest friction */}
      <div className="space-y-3">
        <OAuthButton provider="google" redirectTo={redirect} />
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            or continue with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant={needsVerification ? "default" : "destructive"}>
            {needsVerification ? (
              <Mail className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              <p>{error}</p>
              {needsVerification && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={handleResendVerification}
                  disabled={isResending || resendCooldown > 0}
                >
                  {isResending ? (
                    <>
                      <Spinner /> Sending...
                    </>
                  ) : resendCooldown > 0 ? (
                    `Resend in ${resendCooldown}s`
                  ) : (
                    "Resend verification email"
                  )}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            disabled={isPending}
            placeholder="you@example.com"
            aria-invalid={!!fieldErrors.email}
          />
          <FieldError>{fieldErrors.email}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            disabled={isPending}
            placeholder="••••••••"
            aria-invalid={!!fieldErrors.password}
          />
          <FieldError>{fieldErrors.password}</FieldError>
        </Field>

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending && <Spinner />}
          {isPending ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="text-primary font-medium hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
