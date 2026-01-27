import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmailChangeForm } from "./email-change-form";

export default async function EmailSettingsPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Address</CardTitle>
        <CardDescription>Manage your email address</CardDescription>
      </CardHeader>
      <CardContent>
        <EmailChangeForm currentEmail={user.email} />
      </CardContent>
    </Card>
  );
}
