import { LoginForm } from "./login-form";
import { getUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";

// Force dynamic rendering - auth state must be checked on every request
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getUser();

  if (user) {
    redirect("/dashboard");
  }
  return <LoginForm />;
}
