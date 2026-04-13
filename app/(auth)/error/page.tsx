"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { XCircle } from "lucide-react";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const errorMessages: Record<string, { title: string; description: string }> =
    {
      access_denied: {
        title: "Access Denied",
        description: "You do not have permission to access this resource.",
      },
      invalid_request: {
        title: "Invalid Request",
        description: "The request was invalid or malformed.",
      },
      server_error: {
        title: "Server Error",
        description: "An unexpected error occurred. Please try again later.",
      },
      email_not_confirmed: {
        title: "Email Not Confirmed",
        description:
          "Please check your email and confirm your account before signing in.",
      },
      invalid_credentials: {
        title: "Invalid Credentials",
        description: "The email or password you entered is incorrect.",
      },
      user_not_found: {
        title: "User Not Found",
        description: "No account found with this email address.",
      },
      expired_token: {
        title: "Link Expired",
        description:
          "This confirmation link has expired. Please request a new one.",
      },
    };

  const errorInfo = error
    ? errorMessages[error] || {
        title: "Authentication Error",
        description:
          errorDescription || "An error occurred during authentication.",
      }
    : {
        title: "Something went wrong",
        description: "An unexpected error occurred. Please try again.",
      };

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 border border-red-100">
        <XCircle className="h-6 w-6 text-red-600" />
      </div>

      <div className="space-y-1.5">
        <h1 className="text-xl font-bold">{errorInfo.title}</h1>
        <p className="text-sm text-muted-foreground">{errorInfo.description}</p>
      </div>

      <div className="flex flex-col gap-3">
        <Button asChild className="w-full">
          <Link href="/login">Back to Login</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">Go to Homepage</Link>
        </Button>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
