import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { hasMinimumRole } from "@/lib/auth/context";
import { getPageLayouts } from "@/lib/db/queries/page-layouts";
import { PagesManagerClient } from "@/components/page-builder/pages-manager-client";

interface CustomizePageProps {
  params: Promise<{ slug: string }>;
}

export default async function CustomizePage({ params }: CustomizePageProps) {
  const { slug } = await params;

  const user = await getUser();
  if (!user) redirect("/login");

  const store = await getTenantBySlug(slug);
  if (!store) notFound();

  const canManage = await hasMinimumRole(store.id, "admin");
  if (!canManage) redirect(`/dashboard/${slug}`);

  const pages = await getPageLayouts(store.id);

  return (
    <PagesManagerClient
      tenantId={store.id}
      storeSlug={store.slug}
      storeName={store.name}
      initialPages={pages}
    />
  );
}
