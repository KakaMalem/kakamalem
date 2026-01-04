import { LoginForm } from "./login-form";
import { getUser } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const user = await getUser();

  if (user) {
    redirect("/dashboard");
  }
  return <LoginForm />;
}
