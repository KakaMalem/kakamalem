"use client";

import { useState, useTransition } from "react";
import { signUp } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof SignupInput, string>>
  >({});
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      setError(null);
      setFieldErrors({});

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
          return;
        }
      }

      // Ensure loading state is visible for at least 500ms
      const [result] = await Promise.all([
        signUp(formData),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);

      if (result.error) {
        setError(result.error.message);
        return;
      }

      setSuccess(true);
    });
  }

  if (success) {
    return (
      <AuthStatusCard
        variant="success"
        title="Check your email"
        description="We've sent you a confirmation link. Please check your email to verify your account."
        secondaryAction={{
          label: "Back to login",
          href: "/auth/login",
        }}
      />
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
            <Input
              id="password"
              name="password"
              type="password"
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
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
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
            href="/auth/login"
            className="text-primary font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
