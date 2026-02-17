import { redirect } from "next/navigation";
import { getUser, getUserProfile, isPlatformAdmin } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { AdminSidebarNav } from "@/components/admin/admin-sidebar-nav";
import {
  LayoutDashboard,
  Store,
  Users,
  Settings,
  LogOut,
  Shield,
  Handshake,
} from "lucide-react";

// =============================================================================
// ADMIN LAYOUT
// =============================================================================
// Protected layout for platform administrators
// Only users with platform_admin or super_admin role can access
// Mobile-first responsive design with sheet navigation on mobile
// =============================================================================

export const metadata = {
  title: "Admin Panel - Kaka Malem",
  description: "Platform administration dashboard",
  robots: "noindex, nofollow",
};

async function getPendingCounts() {
  try {
    const { getPlatformAffiliateStatsSummary } =
      await import("@/lib/db/queries/platform-affiliates");
    const stats = await getPlatformAffiliateStatsSummary();
    return {
      pendingApplications: stats.pendingApplications,
      pendingPayouts: stats.pendingPayouts,
    };
  } catch {
    return { pendingApplications: 0, pendingPayouts: 0 };
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  const isAdmin = await isPlatformAdmin();

  if (!user) {
    redirect("/auth/login?callbackUrl=/admin");
  }

  if (!isAdmin) {
    redirect("/?error=unauthorized");
  }

  const [profile, pendingCounts] = await Promise.all([
    getUserProfile(),
    getPendingCounts(),
  ]);

  const roleLabel =
    profile?.platformRole === "super_admin" ? "Super Admin" : "Platform Admin";

  const totalPending =
    pendingCounts.pendingApplications + pendingCounts.pendingPayouts;

  const navItems = [
    { href: "/admin", icon: LayoutDashboard, label: "Dashboard", badge: 0 },
    { href: "/admin/stores", icon: Store, label: "Stores", badge: 0 },
    { href: "/admin/users", icon: Users, label: "Users", badge: 0 },
    {
      href: "/admin/affiliates",
      icon: Handshake,
      label: "Affiliates",
      badge: totalPending,
    },
    { href: "/admin/settings", icon: Settings, label: "Settings", badge: 0 },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile Header */}
      <AdminMobileNav
        user={{ name: user.name, email: user.email || "" }}
        roleLabel={roleLabel}
      />

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-background lg:block">
          {/* Logo */}
          <div className="flex h-16 items-center gap-2 border-b px-6">
            <Shield className="size-6 text-primary" />
            <span className="font-bold">Admin Panel</span>
          </div>

          {/* Navigation */}
          <AdminSidebarNav navItems={navItems} />

          {/* User info & logout */}
          <div className="absolute bottom-0 left-0 right-0 border-t p-4">
            <div className="mb-3 space-y-1">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
              <Badge variant="secondary" className="mt-1 text-xs">
                {roleLabel}
              </Badge>
            </div>
            <form action="/auth/logout" method="post">
              <Button variant="outline" size="sm" className="w-full">
                <LogOut className="mr-2 size-4" />
                Logout
              </Button>
            </form>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-h-screen flex-1 p-4 lg:ml-64 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
