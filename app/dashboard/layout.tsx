import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

import { getUser, getUserProfile } from "@/lib/auth/server";

// Force dynamic rendering - auth state must be checked on every request
export const dynamic = "force-dynamic";
import { getUserStores } from "@/lib/db/queries/tenants";
import { getPendingTransferRequestsForUser } from "@/lib/db/queries/store-transfers";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { TransferRequestsBanner } from "@/components/dashboard/transfers/transfer-requests-banner";
import { ImagePreviewProvider } from "@/components/ui/image-preview";
import { QueryProvider } from "@/lib/providers/query-provider";
import { NotificationSoundProvider } from "@/lib/hooks/use-notification-sound";
import type { StoreInfo } from "@/components/dashboard/store-switcher";

// Extract store slug from pathname like /dashboard/my-store/...
// Handles URL-encoded Unicode slugs (e.g., %D9%86%D9%88%D9%86 -> نون)
function getStoreSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/([^/]+)/);
  if (match && match[1] !== "new" && match[1] !== "account") {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
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

  // Transform to StoreInfo format (include posEnabled and userRole for client-side navigation)
  const stores: StoreInfo[] = userStores.map((store) => ({
    id: store.id,
    slug: store.slug,
    name: store.name,
    logoUrl: store.logoUrl,
    posEnabled: store.posEnabled,
    userRole: store.userRole,
  }));

  // Find the current store from URL or fall back to first store
  let currentStore: StoreInfo | null = null;
  let storeSlug: string | undefined;

  if (urlStoreSlug) {
    const matchedStore = stores.find((s) => s.slug === urlStoreSlug);
    if (matchedStore) {
      currentStore = matchedStore;
    }
    storeSlug = urlStoreSlug;
  }

  if (!currentStore && stores.length > 0) {
    currentStore = stores[0];
    storeSlug = currentStore.slug;
  }

  // Fetch pending transfer requests for this user
  const pendingTransfers = await getPendingTransferRequestsForUser(user.id);

  // Get sidebar state from cookie
  const cookieStore = await cookies();
  const sidebarState = cookieStore.get("sidebar_state")?.value;
  const defaultOpen = sidebarState !== "false";

  return (
    <QueryProvider>
      <NotificationSoundProvider>
        <ImagePreviewProvider>
          <SidebarProvider defaultOpen={defaultOpen}>
            <AppSidebar
              user={{
                id: user.id,
                email: user.email || "",
                fullName: user.name,
                avatarUrl: user.image || undefined,
              }}
              stores={stores}
              currentStore={currentStore}
              storeSlug={storeSlug}
            />
            <SidebarInset>
              <DashboardHeader />
              <main className="flex-1 overflow-auto p-4 md:p-6">
                <TransferRequestsBanner
                  requests={pendingTransfers.map((t) => ({
                    id: t.id,
                    tenant: t.tenant,
                    fromUser: t.fromUser,
                    message: t.message,
                    expiresAt: t.expiresAt,
                    createdAt: t.createdAt,
                  }))}
                />
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
        </ImagePreviewProvider>
      </NotificationSoundProvider>
    </QueryProvider>
  );
}
