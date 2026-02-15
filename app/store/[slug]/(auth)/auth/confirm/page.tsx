"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2, Mail } from "lucide-react";
import { useStoreBasePath } from "@/components/store/store-path-provider";

function ConfirmContent() {
  const searchParams = useSearchParams();
  const basePath = useStoreBasePath();
  const type = searchParams.get("type");

  const confirmMessages: Record<
    string,
    {
      title: string;
      description: string;
      cta: string;
      ctaHref: string;
      icon: "check" | "mail";
    }
  > = {
    signup: {
      title: "Account Created",
      description:
        "Your account has been created successfully. You can now sign in to start shopping.",
      cta: "Sign In",
      ctaHref: `${basePath}/auth/login`,
      icon: "check",
    },
    recovery: {
      title: "Password Reset",
      description:
        "Your password has been reset successfully. You can now sign in with your new password.",
      cta: "Sign In",
      ctaHref: `${basePath}/auth/login`,
      icon: "check",
    },
    email_change: {
      title: "Email Updated",
      description: "Your email address has been updated successfully.",
      cta: "Continue Shopping",
      ctaHref: basePath,
      icon: "check",
    },
    email_confirmed: {
      title: "Email Confirmed",
      description:
        "Your email has been confirmed. You can now sign in to your account.",
      cta: "Sign In",
      ctaHref: `${basePath}/auth/login`,
      icon: "check",
    },
    password_reset_sent: {
      title: "Check Your Email",
      description:
        "If an account exists with that email, we've sent you a link to reset your password.",
      cta: "Back to Sign In",
      ctaHref: `${basePath}/auth/login`,
      icon: "mail",
    },
    verification_sent: {
      title: "Verification Email Sent",
      description:
        "We've sent you a confirmation link. Please check your email to verify your account.",
      cta: "Back to Sign In",
      ctaHref: `${basePath}/auth/login`,
      icon: "mail",
    },
  };

  const confirmInfo = type
    ? confirmMessages[type] || {
        title: "Success",
        description: "Your action was completed successfully.",
        cta: "Continue",
        ctaHref: basePath,
        icon: "check" as const,
      }
    : {
        title: "Success",
        description: "Your action was completed successfully.",
        cta: "Continue",
        ctaHref: basePath,
        icon: "check" as const,
      };

  return (
    <Card>
      <CardContent className="pt-6 space-y-6 text-center">
        {confirmInfo.icon === "mail" ? (
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
        ) : (
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
        )}

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{confirmInfo.title}</h1>
          <p className="text-muted-foreground">{confirmInfo.description}</p>
        </div>

        <div className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href={confirmInfo.ctaHref}>{confirmInfo.cta}</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href={basePath}>Go to Store</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StoreAuthConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-8">
          <Spinner size="lg" />
        </div>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
