import {
  SettingsNav,
  SettingsNavTabs,
} from "@/components/dashboard/settings-nav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
