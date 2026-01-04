import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

import { getUser } from "@/lib/supabase/auth";
import { getUserStores } from "@/lib/db/queries/tenants";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import type { StoreInfo } from "@/components/dashboard/store-switcher";

// Extract store slug from pathname like /dashboard/my-store/...
function getStoreSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/([^/]+)/);
  if (match && match[1] !== "new" && match[1] !== "account") {
    return match[1];
  }
  return null;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  // Get current path to determine active store
  const headersList = await headers();
  const pathname =
    headersList.get("x-pathname") || headersList.get("x-invoke-path") || "";
  const urlStoreSlug = getStoreSlugFromPath(pathname);

  // Fetch user's stores
  const userStores = await getUserStores(user.id);

  // Transform to StoreInfo format
  const stores: StoreInfo[] = userStores.map((store) => ({
    id: store.id,
    slug: store.slug,
    name: store.name,
    logoUrl: store.logoUrl,
  }));

  // Find the current store from URL or fall back to first store
  let currentStore: StoreInfo | null = null;
  let storeSlug: string | undefined;

  if (urlStoreSlug) {
    currentStore = stores.find((s) => s.slug === urlStoreSlug) || null;
    storeSlug = urlStoreSlug;
  }

  if (!currentStore && stores.length > 0) {
    currentStore = stores[0];
    storeSlug = currentStore.slug;
  }

  // Get sidebar state from cookie
  const cookieStore = await cookies();
  const sidebarState = cookieStore.get("sidebar_state")?.value;
  const defaultOpen = sidebarState !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar
        user={{
          email: user.email || "",
          fullName: user.user_metadata?.full_name,
          avatarUrl: user.user_metadata?.avatar_url,
        }}
        stores={stores}
        currentStore={currentStore}
        storeSlug={storeSlug}
      />
      <SidebarInset>
        <DashboardHeader storeSlug={storeSlug} />
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
