import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getUser } from "@/lib/supabase/auth";
import { getUserStores } from "@/lib/db/queries/tenants";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import type { StoreInfo } from "@/components/dashboard/store-switcher";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch user's stores
  const userStores = await getUserStores(user.id);

  // Transform to StoreInfo format
  const stores: StoreInfo[] = userStores.map((store) => ({
    id: store.id,
    slug: store.slug,
    name: store.name,
    logoUrl: store.logoUrl,
  }));

  // For now, use the first store as current (later: use URL param or cookie)
  const currentStore = stores.length > 0 ? stores[0] : null;

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
      />
      <SidebarInset>
        <DashboardHeader />
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
