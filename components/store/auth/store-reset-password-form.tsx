"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resetPassword } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { z } from "zod";
import { handleFormErrors } from "@/lib/utils/form-errors";

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain an uppercase letter")
      .regex(/[a-z]/, "Password must contain a lowercase letter")
      .regex(/[0-9]/, "Password must contain a number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// Map field names to DOM element IDs for scroll-to-error
const FIELD_ID_MAP: Record<string, string> = {
  password: "password",
  confirmPassword: "confirmPassword",
};

interface StoreResetPasswordFormProps {
  store: {
    slug: string;
    name: string;
    logoUrl?: string | null;
  };
  token?: string;
}

export function StoreResetPasswordForm({
  store,
  token,
}: StoreResetPasswordFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ResetPasswordInput, string>>
  >({});
  const [success, setSuccess] = useState(false);
  const [isPending, setIsPending] = useState(false);

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

  // Check for valid token
  if (!token) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="size-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Invalid Reset Link</h2>
              <p className="text-muted-foreground">
                This password reset link is invalid or has expired. Please
                request a new one.
              </p>
            </div>
            <Button asChild className="mt-4">
              <Link href={`/store/${store.slug}/auth/forgot-password`}>
                Request New Link
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    setError(null);
    setFieldErrors({});
    setIsPending(true);

    // Client-side validation
    const formValues = {
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };

    const result = resetPasswordSchema.safeParse(formValues);
    if (!result.success) {
      const errors: Partial<Record<keyof ResetPasswordInput, string>> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          errors[issue.path[0] as keyof ResetPasswordInput] = issue.message;
        }
      });
      setFieldErrors(errors);
      handleFormErrors(errors, FIELD_ID_MAP);
      setIsPending(false);
      return;
    }

    try {
      // Token is guaranteed to exist at this point (early return above handles undefined)
      const response = await resetPassword(token!, formValues.password);

      if (response.error) {
        const errorMessage =
          response.error.message || "Failed to reset password";
        // Check for expired token error
        if (
          errorMessage.toLowerCase().includes("expired") ||
          errorMessage.toLowerCase().includes("invalid")
        ) {
          setError(
            "This reset link has expired. Please request a new password reset."
          );
        } else {
          setError(errorMessage);
        }
        setIsPending(false);
        return;
      }

      setSuccess(true);
      // Redirect to login after showing success message
      setTimeout(() => {
        router.push(`/store/${store.slug}/auth/login`);
      }, 3000);
    } catch (err) {
      console.error("Reset password error:", err);
      setError("An unexpected error occurred");
      setIsPending(false);
    }
  }

  if (success) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="size-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Password Reset!</h2>
              <p className="text-muted-foreground">
                Your password has been reset successfully. You can now sign in
                with your new password.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Redirecting to sign in...
            </p>
            <Button asChild className="mt-4">
              <Link href={`/store/${store.slug}/auth/login`}>Sign In Now</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-4 text-center pb-2">
        {/* Store Branding */}
        <div className="flex flex-col items-center gap-3">
          {store.logoUrl ? (
            <Logo logoUrl={store.logoUrl} alt={store.name} size="xl" />
          ) : (
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <KeyRound className="size-6 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">Reset your password</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter a new password for your account
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Field>
            <FieldLabel htmlFor="password">New password</FieldLabel>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              disabled={isPending}
              placeholder="Enter new password"
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
            <FieldLabel htmlFor="confirmPassword">
              Confirm new password
            </FieldLabel>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              disabled={isPending}
              placeholder="Confirm your password"
              aria-invalid={!!fieldErrors.confirmPassword}
            />
            <FieldError>{fieldErrors.confirmPassword}</FieldError>
          </Field>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending && <Spinner />}
            {isPending ? "Resetting..." : "Reset password"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground pt-2">
          Remember your password?{" "}
          <Link
            href={`/store/${store.slug}/auth/login`}
            className="text-primary font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
