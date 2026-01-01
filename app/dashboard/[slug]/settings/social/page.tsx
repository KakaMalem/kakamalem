import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/auth";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
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
    redirect("/auth/login");
  }

  const store = await getTenantBySlug(slug);

  if (!store) {
    notFound();
  }

  if (store.ownerId !== user.id) {
    notFound();
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
      }}
    />
  );
}
