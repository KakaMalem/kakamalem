"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2, XCircle } from "lucide-react";

export default function LogoutPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function handleLogout() {
      try {
        await signOut();
        setStatus("success");
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 2000);
      } catch (error) {
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "An unexpected error occurred"
        );
      }
    }

    handleLogout();
  }, [router]);

  if (status === "loading") {
    return (
      <div className="space-y-6 text-center">
        <Spinner size="lg" className="mx-auto" />
        <p className="text-sm text-muted-foreground">Signing you out...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 border border-red-100">
          <XCircle className="h-6 w-6 text-red-600" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-xl font-bold">Sign Out Failed</h1>
          <p className="text-sm text-muted-foreground">
            {errorMessage || "We couldn't sign you out. Please try again."}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button onClick={() => window.location.reload()} className="w-full">
            Try Again
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100">
        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
      </div>

      <div className="space-y-1.5">
        <h1 className="text-xl font-bold">Signed Out</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;ve been signed out. Redirecting to homepage...
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button asChild className="w-full">
          <Link href="/">Go to Homepage</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/login">Sign in again</Link>
        </Button>
      </div>
    </div>
  );
}
