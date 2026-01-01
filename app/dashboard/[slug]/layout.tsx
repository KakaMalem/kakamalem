import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/auth";
import { getUserStores, getTenantBySlug } from "@/lib/db/queries/tenants";

interface StoreLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

// This layout validates store access without rendering any UI
// The parent /dashboard/layout.tsx handles the sidebar
export default async function StoreLayout({
  children,
  params,
}: StoreLayoutProps) {
  const { slug } = await params;
  const user = await getUser();

  if (!user) {
    notFound();
  }

  // Fetch the requested store
  const store = await getTenantBySlug(slug);

  if (!store) {
    notFound();
  }

  // Fetch all user's stores to check access
  const userStores = await getUserStores(user.id);

  // Check if user has access to this store
  const hasAccess = userStores.some((s) => s.id === store.id);
  if (!hasAccess) {
    notFound();
  }

  // Just pass through children - parent layout handles the UI
  return <>{children}</>;
}
