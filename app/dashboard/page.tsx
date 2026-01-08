import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getUserStores } from "@/lib/db/queries/tenants";
import { DashboardRedirect } from "./dashboard-redirect";

export default async function DashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user's stores
  const stores = await getUserStores(user.id);

  if (stores.length === 0) {
    // No stores yet, redirect to create store page
    redirect("/dashboard/new");
  }

  // Pass stores to client component which checks localStorage for last visited store
  return (
    <DashboardRedirect
      stores={stores.map((s) => ({ slug: s.slug }))}
      fallbackSlug={stores[0].slug}
    />
  );
}
