"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { resendVerificationEmail } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle } from "lucide-react";
import { OAuthButton } from "@/components/auth/oauth-button";
import { AuthStatusCard } from "@/components/auth/auth-status-card";
import Link from "next/link";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";
import { ZodError } from "zod";
import { handleFormErrors } from "@/lib/utils/form-errors";

// Map field names to DOM element IDs for scroll-to-error
const FIELD_ID_MAP: Record<string, string> = {
  fullName: "fullName",
  email: "email",
  password: "password",
  confirmPassword: "confirmPassword",
};

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof SignupInput, string>>
  >({});
  const [success, setSuccess] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function handleResendVerification() {
    if (!signupEmail || isResending || resendCooldown > 0) return;
    setIsResending(true);
    try {
      await resendVerificationEmail(signupEmail);
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
      fullName: formData.get("fullName") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };

    try {
      signupSchema.parse(formValues);
    } catch (err) {
      if (err instanceof ZodError) {
        const errors: Partial<Record<keyof SignupInput, string>> = {};
        err.issues.forEach((issue) => {
          if (issue.path[0]) {
            errors[issue.path[0] as keyof SignupInput] = issue.message;
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
      const result = await authClient.signUp.email({
        name: formValues.fullName,
        email: formValues.email,
        password: formValues.password,
      });

      if (result.error) {
        const errorMessage = result.error.message || "Failed to create account";
        setError(errorMessage);
        toast.error(errorMessage);
        setIsPending(false);
        return;
      }

      // In development, auto sign-in is enabled so redirect to dashboard
      // In production, show email verification message
      setSignupEmail(formValues.email);
      if (process.env.NODE_ENV === "development") {
        setSuccess(true);
        await new Promise((resolve) => setTimeout(resolve, 500));
        window.location.href = "/dashboard";
      } else {
        setSuccess(true);
      }
    } catch (err) {
      console.error("Signup error:", err);
      setError("An unexpected error occurred");
      toast.error("An unexpected error occurred");
      setIsPending(false);
    }
  }

  if (success) {
    // In development, show redirect message; in production, show email verification
    const isDev = process.env.NODE_ENV === "development";
    return (
      <AuthStatusCard
        variant="success"
        title={isDev ? "Account created!" : "Check your email"}
        description={
          isDev
            ? "Redirecting you to your dashboard..."
            : "We've sent you a confirmation link. Please check your email to verify your account."
        }
        secondaryAction={
          isDev
            ? undefined
            : {
                label: "Back to login",
                href: "/login",
              }
        }
      >
        {!isDev && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Didn&apos;t receive the email? Check your spam folder or resend it.
            </p>
            <Button
              variant="outline"
              size="sm"
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
          </div>
        )}
      </AuthStatusCard>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="text-xl font-bold">
            Kaka Malem
          </Link>
          <h1 className="text-2xl font-bold mt-6">Create your account</h1>
          <p className="text-muted-foreground">
            Start building your store today
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Field>
            <FieldLabel htmlFor="fullName">Full name</FieldLabel>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              disabled={isPending}
              placeholder="Your name"
              aria-invalid={!!fieldErrors.fullName}
            />
            <FieldError>{fieldErrors.fullName}</FieldError>
          </Field>

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
              autoComplete="new-password"
              disabled={isPending}
              placeholder="••••••••"
              aria-invalid={!!fieldErrors.password}
            />
            {fieldErrors.password ? (
              <FieldError>{fieldErrors.password}</FieldError>
            ) : (
              <FieldDescription>
                Must contain uppercase, lowercase, and number (min 8 characters)
              </FieldDescription>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              disabled={isPending}
              placeholder="••••••••"
              aria-invalid={!!fieldErrors.confirmPassword}
            />
            <FieldError>{fieldErrors.confirmPassword}</FieldError>
          </Field>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending && <Spinner />}
            {isPending ? "Creating account..." : "Create account"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                OR
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <OAuthButton provider="google" redirectTo="/dashboard" />
            <OAuthButton provider="facebook" redirectTo="/dashboard" />
          </div>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-primary font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
