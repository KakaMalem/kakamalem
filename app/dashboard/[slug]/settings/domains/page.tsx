import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { DomainSettings } from "./domain-settings";

interface DomainSettingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function DomainSettingsPage({
  params,
}: DomainSettingsPageProps) {
  const { slug } = await params;
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const store = await getTenantBySlug(slug);

  if (!store) {
    notFound();
  }

  if (store.ownerId !== user.id) {
    notFound();
  }

  return <DomainSettings storeSlug={store.slug} storeName={store.name} />;
}
