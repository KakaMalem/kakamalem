import { LoginForm } from "./login-form";
import { getUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";

// Force dynamic rendering - auth state must be checked on every request
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getUser();

  if (user) {
    const params = await searchParams;
    const redirectTo = (params.redirect as string) || "/dashboard";
    // Only allow relative paths to prevent open redirect
    const safeRedirect = redirectTo.startsWith("/") ? redirectTo : "/dashboard";
    redirect(safeRedirect);
  }

  return <LoginForm />;
}
