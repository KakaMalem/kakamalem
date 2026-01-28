import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { StoreResetPasswordForm } from "@/components/store/auth/store-reset-password-form";

// Force dynamic rendering
export const dynamic = "force-dynamic";

interface StoreResetPasswordPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const store = await getTenantBySlug(slug);

  if (!store) {
    return { title: "Store Not Found" };
  }

  return {
    title: `Reset password - ${store.name}`,
    description: `Set a new password for your account at ${store.name}`,
  };
}

export default async function StoreResetPasswordPage({
  params,
  searchParams,
}: StoreResetPasswordPageProps) {
  const { slug } = await params;
  const { token } = await searchParams;

  // Fetch store data
  const store = await getTenantBySlug(slug);

  if (!store) {
    notFound();
  }

  return (
    <StoreResetPasswordForm
      store={{
        slug: store.slug,
        name: store.name,
        logoUrl: store.logoUrl,
      }}
      token={token}
    />
  );
}
