import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeleteAccountSection } from "@/components/store/account/account-settings-forms";

export default async function DangerZonePage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="text-destructive">Danger Zone</CardTitle>
        <CardDescription>Irreversible actions</CardDescription>
      </CardHeader>
      <CardContent>
        <DeleteAccountSection />
      </CardContent>
    </Card>
  );
}
