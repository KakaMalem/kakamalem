import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getUserStores } from "@/lib/db/queries/tenants";
import { StoreRedirect } from "./store-redirect";

interface RedirectToStoreProps {
  targetPath: string;
}

export async function RedirectToStore({ targetPath }: RedirectToStoreProps) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const stores = await getUserStores(user.id);

  if (stores.length === 0) {
    redirect("/dashboard/new");
  }

  return (
    <StoreRedirect
      stores={stores.map((s) => ({ slug: s.slug }))}
      fallbackSlug={stores[0].slug}
      targetPath={targetPath}
    />
  );
}
