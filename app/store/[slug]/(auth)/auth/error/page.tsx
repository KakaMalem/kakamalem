"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { XCircle, AlertTriangle } from "lucide-react";
import { useStoreBasePath } from "@/components/store/store-path-provider";

function ErrorContent() {
  const searchParams = useSearchParams();
  const basePath = useStoreBasePath();

  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const errorMessages: Record<
    string,
    { title: string; description: string; severity: "error" | "warning" }
  > = {
    access_denied: {
      title: "Access Denied",
      description: "You do not have permission to access this resource.",
      severity: "error",
    },
    invalid_request: {
      title: "Invalid Request",
      description: "The request was invalid or malformed.",
      severity: "error",
    },
    server_error: {
      title: "Server Error",
      description: "An unexpected error occurred. Please try again later.",
      severity: "error",
    },
    email_not_confirmed: {
      title: "Email Not Confirmed",
      description:
        "Please check your email and confirm your account before signing in.",
      severity: "warning",
    },
    invalid_credentials: {
      title: "Invalid Credentials",
      description: "The email or password you entered is incorrect.",
      severity: "error",
    },
    user_not_found: {
      title: "Account Not Found",
      description: "No account found with this email address.",
      severity: "error",
    },
    expired_token: {
      title: "Link Expired",
      description:
        "This confirmation link has expired. Please request a new one.",
      severity: "warning",
    },
    oauth_error: {
      title: "Sign In Failed",
      description:
        "There was a problem signing in with your social account. Please try again.",
      severity: "error",
    },
    account_exists: {
      title: "Account Already Exists",
      description:
        "An account with this email already exists. Please sign in instead.",
      severity: "warning",
    },
    rate_limited: {
      title: "Too Many Attempts",
      description:
        "You've made too many attempts. Please wait a few minutes and try again.",
      severity: "warning",
    },
  };

  const errorInfo = error
    ? errorMessages[error] || {
        title: "Authentication Error",
        description:
          errorDescription || "An error occurred during authentication.",
        severity: "error" as const,
      }
    : {
        title: "Something Went Wrong",
        description: "An unexpected error occurred. Please try again.",
        severity: "error" as const,
      };

  const Icon = errorInfo.severity === "warning" ? AlertTriangle : XCircle;
  const iconBgColor =
    errorInfo.severity === "warning" ? "bg-amber-100" : "bg-destructive/10";
  const iconTextColor =
    errorInfo.severity === "warning" ? "text-amber-600" : "text-destructive";

  return (
    <Card>
      <CardContent className="pt-6 space-y-6 text-center">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${iconBgColor}`}
        >
          <Icon className={`h-8 w-8 ${iconTextColor}`} />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{errorInfo.title}</h1>
          <p className="text-muted-foreground">{errorInfo.description}</p>
        </div>

        <div className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href={`${basePath}/auth/login`}>Back to Sign In</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href={basePath}>Go to Store</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StoreAuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-8">
          <Spinner size="lg" />
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
