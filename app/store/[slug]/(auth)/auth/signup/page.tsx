import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { resolveTenant } from "@/lib/db/queries/tenants";
import { StoreSignupForm } from "@/components/store/auth/store-signup-form";
import { parseRedirectParam } from "@/lib/auth/context";
import { getStoreBasePath } from "@/lib/utils/store-path";

// Force dynamic rendering - auth state must be checked on every request
export const dynamic = "force-dynamic";

interface StoreSignupPageProps {
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
  const store = await resolveTenant(slug);

  if (!store) {
    return { title: "Store Not Found" };
  }

  return {
    title: `Create an account - ${store.name}`,
    description: `Create an account to start shopping at ${store.name}`,
  };
}

export default async function StoreSignupPage({
  params,
  searchParams,
}: StoreSignupPageProps) {
  const { slug } = await params;
  const { redirect: redirectParam } = await searchParams;

  // Fetch store data
  const store = await resolveTenant(slug);

  if (!store) {
    notFound();
  }

  const basePath = await getStoreBasePath(store.slug);

  // Parse redirect parameter safely
  const redirectTo = parseRedirectParam(
    new URLSearchParams(redirectParam ? `redirect=${redirectParam}` : ""),
    basePath
  );

  return (
    <StoreSignupForm
      store={{
        slug: store.slug,
        name: store.name,
        logoUrl: store.logoUrl,
      }}
      redirectTo={redirectTo}
    />
  );
}
