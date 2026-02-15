import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { resolveTenant } from "@/lib/db/queries/tenants";
import { StoreForgotPasswordForm } from "@/components/store/auth/store-forgot-password-form";

// Force dynamic rendering
export const dynamic = "force-dynamic";

interface StoreForgotPasswordPageProps {
  params: Promise<{ slug: string }>;
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const store = await resolveTenant(slug);

  if (!store) {
    return { title: "Store Not Found" };
  }

  return {
    title: `Reset password - ${store.name}`,
    description: `Reset your password to continue shopping at ${store.name}`,
  };
}

export default async function StoreForgotPasswordPage({
  params,
}: StoreForgotPasswordPageProps) {
  const { slug } = await params;

  // Fetch store data
  const store = await resolveTenant(slug);

  if (!store) {
    notFound();
  }

  return (
    <StoreForgotPasswordForm
      store={{
        slug: store.slug,
        name: store.name,
        logoUrl: store.logoUrl,
      }}
    />
  );
}
