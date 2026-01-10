import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { AccountPageContent } from "./account-page-content";

export default async function AccountPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Account Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your personal account settings
        </p>
      </div>

      <AccountPageContent
        user={{
          name: user.name || "",
          email: user.email,
          image: user.image || null,
        }}
      />
    </div>
  );
}
