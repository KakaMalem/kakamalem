import { notFound, redirect } from "next/navigation";

import { resolveTenant } from "@/lib/db/queries/tenants";
import { getUser } from "@/lib/auth/server";
import { getStoreBasePath } from "@/lib/utils/store-path";
import { StorePathProvider } from "@/components/store/store-path-provider";

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
  const store = await resolveTenant(slug);

  if (!store) {
    notFound();
  }

  const basePath = await getStoreBasePath(store.slug);

  // Check if store is active
  if (store.status !== "active") {
    redirect(basePath || "/");
  }

  // Check if user is already logged in
  const user = await getUser();
  if (user) {
    // Already logged in - redirect back to store
    redirect(basePath || "/");
  }

  return (
    <StorePathProvider basePath={basePath}>
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </StorePathProvider>
  );
}
