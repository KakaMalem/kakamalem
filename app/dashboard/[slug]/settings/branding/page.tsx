import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getUserStoreContext } from "@/lib/auth/context";
import { canAccessSettingsPage } from "@/lib/config/settings-permissions";
import { AccessDenied } from "@/components/access-denied";
import type { HomepageLayout } from "@/lib/validations/stores";
import { BrandingSettingsForm } from "./branding-settings-form";

interface BrandingSettingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function BrandingSettingsPage({
  params,
}: BrandingSettingsPageProps) {
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
  if (!userContext || !canAccessSettingsPage(userContext, "branding")) {
    return (
      <AccessDenied
        message="You need admin or owner access to edit branding settings."
        backUrl={`/dashboard/${slug}/settings`}
        backLabel="Back to Settings"
      />
    );
  }

  return (
    <BrandingSettingsForm
      storeId={store.id}
      initialData={{
        logoUrl: store.logoUrl || "",
        faviconUrl: store.faviconUrl || "",
        headerDisplay:
          (store.headerDisplay as
            | "logo_only"
            | "name_only"
            | "logo_and_name") || "logo_and_name",
        homepageLayout: (store.homepageLayout as HomepageLayout) || "products",
      }}
    />
  );
}
