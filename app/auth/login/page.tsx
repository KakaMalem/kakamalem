import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center">Welcome back</h1>
        <p className="mt-2 text-center text-muted-foreground">
          Sign in to your account
        </p>
        <div className="mt-8 rounded-lg border p-6">
          <p className="text-center text-sm text-muted-foreground">
            Authentication coming soon
          </p>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-foreground hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
