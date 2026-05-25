import { redirect } from "next/navigation";
import { getUser, getUserProfile } from "@/lib/auth/server";
import { CreateStoreForm } from "./create-store-form";

export default async function CreateStorePage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getUserProfile();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-2xl font-bold">Start selling</h1>
          <p className="text-muted-foreground">
            Set up your storefront and start accepting orders in minutes
          </p>
        </div>

        <CreateStoreForm
          userEmail={user.email || ""}
          userPhone={profile?.phone || ""}
        />
      </div>
    </div>
  );
}
