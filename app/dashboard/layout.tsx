import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

import { getUser, getUserProfile } from "@/lib/auth/server";

// Force dynamic rendering - auth state must be checked on every request
export const dynamic = "force-dynamic";
import { getUserStores } from "@/lib/db/queries/tenants";
import { getSubscriptionOverview } from "@/lib/db/queries/billing";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ImagePreviewProvider } from "@/components/ui/image-preview";
import { QueryProvider } from "@/lib/providers/query-provider";
import type { StoreInfo } from "@/components/dashboard/store-switcher";
import type { SubscriptionOverview } from "@/lib/db/queries/billing";

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

  // Check if user has completed their profile (phone required)
  const profile = await getUserProfile();
  if (!profile?.phone) {
    redirect("/complete-profile");
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
  let posEnabled = true; // Default to true

  if (urlStoreSlug) {
    const matchedStore = userStores.find((s) => s.slug === urlStoreSlug);
    if (matchedStore) {
      currentStore = {
        id: matchedStore.id,
        slug: matchedStore.slug,
        name: matchedStore.name,
        logoUrl: matchedStore.logoUrl,
      };
      posEnabled = matchedStore.posEnabled;
    }
    storeSlug = urlStoreSlug;
  }

  if (!currentStore && stores.length > 0) {
    currentStore = stores[0];
    storeSlug = currentStore.slug;
    // Get posEnabled from the first store
    const firstStore = userStores.find((s) => s.slug === currentStore!.slug);
    if (firstStore) {
      posEnabled = firstStore.posEnabled;
    }
  }

  // Fetch subscription data for current store
  let subscription: SubscriptionOverview | null = null;
  if (currentStore) {
    subscription = await getSubscriptionOverview(currentStore.id);
  }

  // Get sidebar state from cookie
  const cookieStore = await cookies();
  const sidebarState = cookieStore.get("sidebar_state")?.value;
  const defaultOpen = sidebarState !== "false";

  return (
    <QueryProvider>
      <ImagePreviewProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <AppSidebar
            user={{
              email: user.email || "",
              fullName: user.name,
              avatarUrl: user.image || undefined,
            }}
            stores={stores}
            currentStore={currentStore}
            storeSlug={storeSlug}
            posEnabled={posEnabled}
            subscription={subscription}
          />
          <SidebarInset>
            <DashboardHeader />
            <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </ImagePreviewProvider>
    </QueryProvider>
  );
}
