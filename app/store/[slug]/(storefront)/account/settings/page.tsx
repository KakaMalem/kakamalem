import { notFound } from "next/navigation";
import { User, Lock, Trash2, Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getUser, userHasPassword } from "@/lib/auth/server";
import { resolveTenant } from "@/lib/db/queries/tenants";
import {
  UpdateNameForm,
  ChangePasswordForm,
  DeleteAccountSection,
} from "@/components/store/account/account-settings-forms";
import { CustomerNotificationSettings } from "@/components/store/account/notification-settings";
import { CurrencyPreferenceForm } from "@/components/store/account/currency-preference-form";

interface SettingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { slug } = await params;
  const [user, store, hasPassword] = await Promise.all([
    getUser(),
    resolveTenant(slug),
    userHasPassword(),
  ]);

  if (!store) {
    notFound();
  }

  // Shouldn't happen due to layout protection, but just in case
  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-5" />
            Profile
          </CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>
          <Separator />
          <UpdateNameForm currentName={user.name || ""} />
        </CardContent>
      </Card>

      {/* Currency Preference — only for legacy fiat stores */}
      {store.currency !== "USDT" && store.currency !== "USDC" && (
        <CurrencyPreferenceForm />
      )}

      {/* Notification Settings */}
      <CustomerNotificationSettings
        tenantId={store.id}
        storeName={store.name}
      />

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-5" />
            Security
          </CardTitle>
          <CardDescription>
            {hasPassword
              ? "Manage your password and account security"
              : "Set a password for your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm hasPassword={hasPassword} />
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <Info className="size-4" />
        <AlertDescription>
          Your account settings apply across all stores on Kaka Malem. Changes
          you make here will be reflected everywhere.
        </AlertDescription>
      </Alert>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="size-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountSection />
        </CardContent>
      </Card>
    </div>
  );
}
