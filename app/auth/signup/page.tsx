import { SignupForm } from "./signup-form";
import { getUser } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";

export default async function SignupPage() {
  const user = await getUser();

  if (user) {
    redirect("/dashboard");
  }
  return <SignupForm />;
}
