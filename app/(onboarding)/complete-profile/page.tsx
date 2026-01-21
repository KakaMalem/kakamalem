import { redirect } from "next/navigation";
import { getUser, getUserProfile } from "@/lib/auth/server";
import { PhoneCollectionForm } from "./phone-collection-form";

export default async function CompleteProfilePage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  // If user already has phone, redirect to dashboard
  const profile = await getUserProfile();
  if (profile?.phone) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <p className="text-xl font-bold">Kaka Malem</p>
          <h1 className="text-2xl font-bold mt-6">Complete your profile</h1>
          <p className="text-muted-foreground">
            Please provide your phone number to continue
          </p>
        </div>

        <PhoneCollectionForm userName={user.name || ""} />
      </div>
    </div>
  );
}
