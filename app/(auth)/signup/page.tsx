import { SignupForm } from "./signup-form";
import { getUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export default async function SignupPage() {
  const user = await getUser();

  if (user) {
    redirect("/dashboard");
  }
  return <SignupForm />;
}
