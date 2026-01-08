"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle } from "lucide-react";
import { OAuthButton } from "@/components/auth/oauth-button";
import { AuthStatusCard } from "@/components/auth/auth-status-card";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { ZodError } from "zod";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof LoginInput, string>>
  >({});
  const [success, setSuccess] = useState(false);
  const [isPending, setIsPending] = useState(false);

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
        setError(result.error.message || "Invalid email or password");
        setIsPending(false);
        return;
      }

      // Show success state for 1 second before redirect
      setSuccess(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      router.push(redirect);
      router.refresh();
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred");
      setIsPending(false);
    }
  }

  if (success) {
    return (
      <AuthStatusCard
        variant="success"
        title="Welcome back!"
        description="Redirecting you to your dashboard..."
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
          <h1 className="text-2xl font-bold mt-6">Welcome back</h1>
          <p className="text-muted-foreground">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
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
            <Input
              id="password"
              name="password"
              type="password"
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
            <OAuthButton provider="google" redirectTo={redirect} />
            <OAuthButton provider="facebook" redirectTo={redirect} />
          </div>
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
    </div>
  );
}
