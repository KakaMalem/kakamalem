import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser, getUserProfile, isPlatformAdmin } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Store,
  Settings,
  LogOut,
  Shield,
  Menu,
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

const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/stores", icon: Store, label: "Stores" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

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

  const profile = await getUserProfile();
  const roleLabel =
    profile?.platformRole === "super_admin" ? "Super Admin" : "Platform Admin";

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background px-4 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Menu className="size-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col p-0">
            <SheetHeader className="border-b px-6 py-4">
              <SheetTitle className="flex items-center gap-2">
                <Shield className="size-5 text-primary" />
                Admin Panel
              </SheetTitle>
            </SheetHeader>
            <ScrollArea className="flex-1">
              <nav className="flex flex-col gap-1 p-4">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                ))}
              </nav>
            </ScrollArea>
            <div className="border-t p-4">
              <div className="mb-3 space-y-1">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
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
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-primary" />
          <span className="font-semibold">Admin</span>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-background lg:block">
          {/* Logo */}
          <div className="flex h-16 items-center gap-2 border-b px-6">
            <Shield className="size-6 text-primary" />
            <span className="font-bold">Admin Panel</span>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-1 p-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>

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
