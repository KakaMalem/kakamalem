import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/auth";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
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

  // Verify ownership
  if (store.ownerId !== user.id) {
    notFound();
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
        currency: (store.currency as "AFN" | "USD") || "AFN",
        slug: store.slug,
      }}
    />
  );
}
