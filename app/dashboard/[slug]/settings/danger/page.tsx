import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/auth";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { DangerZoneSettings } from "./danger-zone-settings";

interface DangerSettingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function DangerSettingsPage({
  params,
}: DangerSettingsPageProps) {
  const { slug } = await params;
  const user = await getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const store = await getTenantBySlug(slug);

  if (!store) {
    notFound();
  }

  // Verify ownership
  if (store.ownerId !== user.id) {
    notFound();
  }

  return (
    <DangerZoneSettings
      storeId={store.id}
      storeName={store.name}
      storeSlug={store.slug}
      isActive={store.status === "active"}
    />
  );
}
