import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getUserStoreContext } from "@/lib/auth/context";
import { canAccessSettingsPage } from "@/lib/config/settings-permissions";
import { AccessDenied } from "@/components/access-denied";
import { GeneralSettingsForm } from "./general-settings-form";

interface SettingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
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
  if (!userContext || !canAccessSettingsPage(userContext, "general")) {
    return (
      <AccessDenied
        message="You need admin or owner access to edit general settings."
        backUrl={`/dashboard/${slug}`}
        backLabel="Back to Dashboard"
      />
    );
  }

  return (
    <GeneralSettingsForm
      storeId={store.id}
      initialData={{
        name: store.name,
        tagline: store.tagline || "",
        description: store.description || "",
        contactEmail: store.contactEmail || "",
        contactPhone: store.contactPhone || "",
        currency: store.currency || "USDT",
        slug: store.slug,
      }}
    />
  );
}
