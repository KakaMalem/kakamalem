import {
  AccountSettingsNav,
  AccountSettingsNavTabs,
} from "@/components/account/account-settings-nav";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your personal account and preferences.
        </p>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden">
        <AccountSettingsNavTabs />
      </div>

      {/* Desktop layout: sidebar + content */}
      <div className="flex flex-col gap-8 md:flex-row md:gap-12">
        {/* Sidebar navigation (hidden on mobile) */}
        <aside className="hidden md:block w-64 shrink-0">
          <AccountSettingsNav />
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
