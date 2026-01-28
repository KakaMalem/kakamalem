"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { requestPasswordReset } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AlertCircle, Mail, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

interface StoreForgotPasswordFormProps {
  store: {
    slug: string;
    name: string;
    logoUrl?: string | null;
  };
}

export function StoreForgotPasswordForm({
  store,
}: StoreForgotPasswordFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    setError(null);
    setEmailError(null);
    setIsPending(true);

    // Validate email
    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      const errorMessage = result.error.issues[0].message;
      setEmailError(errorMessage);
      toast.error(errorMessage);
      setIsPending(false);
      return;
    }

    try {
      // Use server action for password reset request
      const result = await requestPasswordReset(email);

      if (result.error) {
        const errorMessage =
          result.error.message || "Failed to send reset email";
        setError(errorMessage);
        toast.error(errorMessage);
        setIsPending(false);
        return;
      }

      // Always show success (even if email doesn't exist - for security)
      setSuccess(true);
    } catch (err) {
      console.error("Forgot password error:", err);
      setError("An unexpected error occurred");
      toast.error("An unexpected error occurred");
      setIsPending(false);
    }
  }

  if (success) {
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
                If an account exists with that email, we&apos;ve sent you a link
                to reset your password.
              </p>
            </div>
            <Button variant="outline" asChild className="mt-4">
              <Link href={`/store/${store.slug}/auth/login`}>
                <ArrowLeft className="mr-2 size-4" />
                Back to sign in
              </Link>
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
            <h1 className="text-2xl font-bold">Forgot password?</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your email and we&apos;ll send you a reset link
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
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              disabled={isPending}
              placeholder="you@example.com"
              aria-invalid={!!emailError}
            />
            <FieldError>{emailError}</FieldError>
          </Field>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending && <Spinner />}
            {isPending ? "Sending..." : "Send reset link"}
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
