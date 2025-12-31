import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center">Create your account</h1>
        <p className="mt-2 text-center text-muted-foreground">
          Start building your store today
        </p>
        <div className="mt-8 rounded-lg border p-6">
          <p className="text-center text-sm text-muted-foreground">
            Authentication coming soon
          </p>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
