import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
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

        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                <div className="h-12 w-full animate-pulse rounded-lg bg-muted" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                <div className="h-12 w-full animate-pulse rounded-lg bg-muted" />
              </div>
              <div className="h-12 w-full animate-pulse rounded-lg bg-muted" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/signup"
            className="text-primary font-medium hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
