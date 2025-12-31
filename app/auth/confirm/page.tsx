"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2 } from "lucide-react";

function ConfirmContent() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type");

  const confirmMessages: Record<
    string,
    { title: string; description: string; cta: string; ctaHref: string }
  > = {
    signup: {
      title: "Account Created",
      description:
        "Your account has been created successfully. You can now sign in to access your dashboard.",
      cta: "Sign In",
      ctaHref: "/auth/login",
    },
    recovery: {
      title: "Password Reset",
      description:
        "Your password has been reset successfully. You can now sign in with your new password.",
      cta: "Sign In",
      ctaHref: "/auth/login",
    },
    email_change: {
      title: "Email Updated",
      description: "Your email address has been updated successfully.",
      cta: "Go to Dashboard",
      ctaHref: "/dashboard",
    },
    email_confirmed: {
      title: "Email Confirmed",
      description:
        "Your email has been confirmed. You can now sign in to your account.",
      cta: "Sign In",
      ctaHref: "/auth/login",
    },
  };

  const confirmInfo = type
    ? confirmMessages[type] || {
        title: "Success",
        description: "Your action was completed successfully.",
        cta: "Continue",
        ctaHref: "/dashboard",
      }
    : {
        title: "Success",
        description: "Your action was completed successfully.",
        cta: "Continue",
        ctaHref: "/dashboard",
      };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6 space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{confirmInfo.title}</h1>
            <p className="text-muted-foreground">{confirmInfo.description}</p>
          </div>

          <div className="flex flex-col gap-3">
            <Button asChild className="w-full">
              <Link href={confirmInfo.ctaHref}>{confirmInfo.cta}</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/">Go to Homepage</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center px-6">
          <Spinner size="lg" />
        </div>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
