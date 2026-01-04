"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
        // Redirect to home after 2 seconds
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
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <Spinner size="lg" className="mx-auto" />
          <p className="text-muted-foreground">Signing you out...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Sign Out Failed</h1>
              <p className="text-muted-foreground">
                {errorMessage || "We couldn't sign you out. Please try again."}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Try Again
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/dashboard">Back to Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6 space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Signed Out Successfully</h1>
            <p className="text-muted-foreground">
              You have been signed out of your account. Redirecting you to the
              homepage...
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button asChild className="w-full">
              <Link href="/">Go to Homepage</Link>
            </Button>
            <Button variant="link" asChild>
              <Link href="/login">Sign in again</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
