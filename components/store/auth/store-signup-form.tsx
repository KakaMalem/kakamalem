"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Mail } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { StoreOAuthButton } from "./store-oauth-button";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";
import { ZodError } from "zod";
import { handleFormErrors } from "@/lib/utils/form-errors";
import { useStoreBasePath } from "@/components/store/store-path-provider";

// Map field names to DOM element IDs for scroll-to-error
const FIELD_ID_MAP: Record<string, string> = {
  fullName: "fullName",
  email: "email",
  password: "password",
  confirmPassword: "confirmPassword",
};

interface StoreSignupFormProps {
  store: {
    slug: string;
    name: string;
    logoUrl?: string | null;
  };
  redirectTo?: string;
}

export function StoreSignupForm({ store, redirectTo }: StoreSignupFormProps) {
  const basePath = useStoreBasePath();
  const finalRedirect = redirectTo || basePath;

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof SignupInput, string>>
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

      // In development, auto sign-in is enabled so redirect
      // In production, show email verification message
      if (process.env.NODE_ENV === "development") {
        setSuccess(true);
        await new Promise((resolve) => setTimeout(resolve, 500));
        window.location.href = finalRedirect;
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
    const isDev = process.env.NODE_ENV === "development";

    if (isDev) {
      return (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex size-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="size-8 text-green-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Account created!</h2>
                <p className="text-muted-foreground">
                  Redirecting you to {store.name}...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-blue-100">
              <Mail className="size-8 text-blue-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Check your email</h2>
              <p className="text-muted-foreground">
                We&apos;ve sent you a confirmation link. Please check your email
                to verify your account.
              </p>
            </div>
            <Button variant="outline" asChild className="mt-4">
              <Link href={`${basePath}/auth/login`}>Back to sign in</Link>
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
          {store.logoUrl && (
            <Logo logoUrl={store.logoUrl} alt={store.name} size="xl" />
          )}
          <div>
            <h1 className="text-2xl font-bold">Create an account</h1>
            <p className="text-sm text-muted-foreground mt-1">
              to start shopping at {store.name}
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
              placeholder="Create a password"
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
              placeholder="Confirm your password"
              aria-invalid={!!fieldErrors.confirmPassword}
            />
            <FieldError>{fieldErrors.confirmPassword}</FieldError>
          </Field>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending && <Spinner />}
            {isPending ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <StoreOAuthButton
            provider="google"
            storeSlug={store.slug}
            redirectTo={finalRedirect}
          />
        </div>

        <p className="text-center text-sm text-muted-foreground pt-2">
          Already have an account?{" "}
          <Link
            href={`${basePath}/auth/login${
              redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""
            }`}
            className="text-primary font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
