import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/auth";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
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
    redirect("/auth/login");
  }

  const store = await getTenantBySlug(slug);

  if (!store) {
    notFound();
  }

  if (store.ownerId !== user.id) {
    notFound();
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
      }}
    />
  );
}
