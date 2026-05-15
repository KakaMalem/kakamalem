import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getUserStoreContext } from "@/lib/auth/context";
import { canAccessSettingsPage } from "@/lib/config/settings-permissions";
import { AccessDenied } from "@/components/access-denied";
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
    redirect("/login");
  }

  const store = await getTenantBySlug(slug);

  if (!store) {
    notFound();
  }

  // Role-based access check (requires admin or owner)
  const userContext = await getUserStoreContext(store.id);
  if (!userContext || !canAccessSettingsPage(userContext, "seo")) {
    return (
      <AccessDenied
        message="You need admin or owner access to edit SEO settings."
        backUrl={`/dashboard/${slug}/settings`}
        backLabel="Back to Settings"
      />
    );
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
