import { redirect } from "next/navigation";
import { getUser, userHasPassword } from "@/lib/auth/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/store/account/account-settings-forms";

export default async function PasswordSettingsPage() {
  const [user, hasPassword] = await Promise.all([getUser(), userHasPassword()]);

  if (!user) {
    redirect("/login");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          {hasPassword
            ? "Change your password"
            : "Set a password for your account"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChangePasswordForm hasPassword={hasPassword} />
      </CardContent>
    </Card>
  );
}
