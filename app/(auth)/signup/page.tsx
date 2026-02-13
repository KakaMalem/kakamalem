import { SignupForm } from "./signup-form";
import { getUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getUser();

  if (user) {
    const params = await searchParams;
    const redirectTo = (params.redirect as string) || "/dashboard";
    const safeRedirect = redirectTo.startsWith("/") ? redirectTo : "/dashboard";
    redirect(safeRedirect);
  }
  return <SignupForm />;
}
