"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
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
      ctaHref: "/login",
    },
    recovery: {
      title: "Password Reset",
      description:
        "Your password has been reset successfully. You can now sign in with your new password.",
      cta: "Sign In",
      ctaHref: "/login",
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
      ctaHref: "/login",
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
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100">
        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
      </div>

      <div className="space-y-1.5">
        <h1 className="text-xl font-bold">{confirmInfo.title}</h1>
        <p className="text-sm text-muted-foreground">
          {confirmInfo.description}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button asChild className="w-full">
          <Link href={confirmInfo.ctaHref}>{confirmInfo.cta}</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">Go to Homepage</Link>
        </Button>
      </div>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
