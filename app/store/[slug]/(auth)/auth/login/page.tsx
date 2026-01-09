import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { StoreLoginForm } from "@/components/store/auth/store-login-form";
import { parseRedirectParam } from "@/lib/auth/context";

// Force dynamic rendering - auth state must be checked on every request
export const dynamic = "force-dynamic";

interface StoreLoginPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ redirect?: string }>;
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
    title: `Sign in - ${store.name}`,
    description: `Sign in to your account to continue shopping at ${store.name}`,
  };
}

export default async function StoreLoginPage({
  params,
  searchParams,
}: StoreLoginPageProps) {
  const { slug } = await params;
  const { redirect: redirectParam } = await searchParams;

  // Fetch store data
  const store = await getTenantBySlug(slug);

  if (!store) {
    notFound();
  }

  // Parse redirect parameter safely
  const redirectTo = parseRedirectParam(
    new URLSearchParams(redirectParam ? `redirect=${redirectParam}` : ""),
    `/store/${slug}`
  );

  return (
    <StoreLoginForm
      store={{
        slug: store.slug,
        name: store.name,
        logoUrl: store.logoUrl,
      }}
      redirectTo={redirectTo}
    />
  );
}
