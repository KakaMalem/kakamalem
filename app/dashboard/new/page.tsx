import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/auth";
import { CreateStoreForm } from "./create-store-form";

export default async function CreateStorePage() {
  const user = await getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-2xl font-bold">Create your store</h1>
          <p className="text-muted-foreground">
            Set up your online store in a few simple steps
          </p>
        </div>

        <CreateStoreForm userEmail={user.email || ""} />
      </div>
    </div>
  );
}
