import { notFound, redirect } from "next/navigation";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getUser } from "@/lib/auth/server";

interface StoreAuthLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function StoreAuthLayout({
  children,
  params,
}: StoreAuthLayoutProps) {
  const { slug } = await params;

  // Fetch store data
  const store = await getTenantBySlug(slug);

  if (!store) {
    notFound();
  }

  // Check if store is active
  if (store.status !== "active") {
    redirect(`/store/${slug}`);
  }

  // Check if user is already logged in
  const user = await getUser();
  if (user) {
    // Already logged in - redirect back to store
    redirect(`/store/${slug}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
