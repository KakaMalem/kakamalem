import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getUserStoreContext } from "@/lib/auth/context";
import { canAccessSettingsPage } from "@/lib/config/settings-permissions";
import { AccessDenied } from "@/components/access-denied";
import { SocialLinksForm } from "./social-links-form";
import type { SocialLinks } from "@/lib/db/schema";

interface SocialLinksPageProps {
  params: Promise<{ slug: string }>;
}

export default async function SocialLinksPage({
  params,
}: SocialLinksPageProps) {
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
  if (!userContext || !canAccessSettingsPage(userContext, "social")) {
    return (
      <AccessDenied
        message="You need admin or owner access to edit social links."
        backUrl={`/dashboard/${slug}/settings`}
        backLabel="Back to Settings"
      />
    );
  }

  const socialLinks = (store.socialLinks as SocialLinks) || {};

  return (
    <SocialLinksForm
      storeId={store.id}
      initialData={{
        facebook: socialLinks.facebook || "",
        instagram: socialLinks.instagram || "",
        twitter: socialLinks.twitter || "",
        whatsapp: socialLinks.whatsapp || "",
        telegram: socialLinks.telegram || "",
        tiktok: socialLinks.tiktok || "",
        youtube: socialLinks.youtube || "",
        preferredContactMethod:
          socialLinks.preferredContactMethod || "whatsapp",
        showWhatsAppButton: socialLinks.showWhatsAppButton ?? true,
      }}
    />
  );
}
