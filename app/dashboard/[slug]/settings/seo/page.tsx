import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/auth";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { SeoSettingsForm } from "./seo-settings-form";
import type { SeoMetadata } from "@/lib/db/schema";

interface SeoSettingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function SeoSettingsPage({
  params,
}: SeoSettingsPageProps) {
  const { slug } = await params;
  const user = await getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const store = await getTenantBySlug(slug);

  if (!store) {
    notFound();
  }

  if (store.ownerId !== user.id) {
    notFound();
  }

  const seo = (store.seo as SeoMetadata) || {};

  return (
    <SeoSettingsForm
      storeId={store.id}
      storeName={store.name}
      initialData={{
        metaTitle: seo.metaTitle || "",
        metaDescription: seo.metaDescription || "",
        ogImageUrl: seo.ogImageUrl || "",
      }}
    />
  );
}
