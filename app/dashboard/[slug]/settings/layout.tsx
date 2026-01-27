import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getUserStoreContext } from "@/lib/auth/context";
import { canAccessAnySettings } from "@/lib/config/settings-permissions";
import { AccessDenied } from "@/components/access-denied";
import {
  SettingsNav,
  SettingsNavTabs,
} from "@/components/dashboard/settings-nav";

interface SettingsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function SettingsLayout({
  children,
  params,
}: SettingsLayoutProps) {
  const { slug } = await params;
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const store = await getTenantBySlug(slug);

  if (!store) {
    notFound();
  }

  // Check if user can access any settings
  const userContext = await getUserStoreContext(store.id);
  if (!userContext || !canAccessAnySettings(userContext.role)) {
    return (
      <AccessDenied
        message="You don't have permission to access store settings. Only store owners and admins can access this area."
        backUrl={`/dashboard/${slug}`}
        backLabel="Back to Store Dashboard"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Store Settings</h1>
        <p className="text-muted-foreground">
          Manage your store configuration and preferences.
        </p>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden">
        <SettingsNavTabs />
      </div>

      {/* Desktop layout: sidebar + content */}
      <div className="flex flex-col gap-8 md:flex-row md:gap-12">
        {/* Sidebar navigation (hidden on mobile) */}
        <aside className="hidden md:block w-64 shrink-0">
          <SettingsNav />
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
