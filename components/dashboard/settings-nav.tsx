"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/lib/stores/use-user-role-store";
import {
  SETTINGS_GROUPS,
  SETTINGS_PAGES,
  canAccessSettingsPage,
} from "@/lib/config/settings-permissions";

// Extract store slug from pathname like /dashboard/my-store/settings
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

export function SettingsNav() {
  const pathname = usePathname();
  const storeSlug = getStoreSlugFromPath(pathname);
  const baseUrl = storeSlug
    ? `/dashboard/${storeSlug}/settings`
    : "/dashboard/settings";

  // Get user role and filter settings pages
  const userRole = useUserRole();
  const accessiblePages = SETTINGS_PAGES.filter(
    (page) => !page.hidden && canAccessSettingsPage(userRole, page.key)
  );

  const isActive = (href: string) => {
    const fullHref = href ? `${baseUrl}${href}` : baseUrl;
    if (fullHref === baseUrl) {
      return pathname === baseUrl;
    }
    return pathname === fullHref;
  };

  // Group pages by section
  const groupedPages = SETTINGS_GROUPS.map((group) => ({
    group,
    pages: accessiblePages.filter((p) => p.group === group.key),
  })).filter((entry) => entry.pages.length > 0);

  return (
    <nav className="flex flex-col">
      {groupedPages.map((entry, groupIndex) => (
        <div key={entry.group.key}>
          <p
            className={cn(
              "px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
              groupIndex === 0 ? "pt-0" : "pt-5"
            )}
          >
            {entry.group.title}
          </p>
          <div className="space-y-1">
            {entry.pages.map((page) => {
              const fullHref = page.href ? `${baseUrl}${page.href}` : baseUrl;
              return (
                <Link
                  key={page.key}
                  href={fullHref}
                  className={cn(
                    "flex flex-col rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/50",
                    isActive(page.href) && "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "font-medium",
                      !isActive(page.href) && "text-foreground/80"
                    )}
                  >
                    {page.title}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {page.description}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

// Horizontal tabs version for mobile
export function SettingsNavTabs() {
  const pathname = usePathname();
  const storeSlug = getStoreSlugFromPath(pathname);
  const baseUrl = storeSlug
    ? `/dashboard/${storeSlug}/settings`
    : "/dashboard/settings";

  // Get user role and filter settings pages
  const userRole = useUserRole();
  const accessiblePages = SETTINGS_PAGES.filter(
    (page) => !page.hidden && canAccessSettingsPage(userRole, page.key)
  );

  const isActive = (href: string) => {
    const fullHref = href ? `${baseUrl}${href}` : baseUrl;
    if (fullHref === baseUrl) {
      return pathname === baseUrl;
    }
    return pathname === fullHref;
  };

  // Group for dividers
  const groupedPages = SETTINGS_GROUPS.map((group) => ({
    group,
    pages: accessiblePages.filter((p) => p.group === group.key),
  })).filter((entry) => entry.pages.length > 0);

  return (
    <nav className="-mb-px flex overflow-x-auto border-b pb-px scrollbar-none">
      {groupedPages.map((entry, groupIndex) => (
        <div key={entry.group.key} className="flex shrink-0 items-center">
          {groupIndex > 0 && (
            <div className="mx-1 h-5 w-px shrink-0 bg-border" />
          )}
          {entry.pages.map((page) => {
            const fullHref = page.href ? `${baseUrl}${page.href}` : baseUrl;
            return (
              <Link
                key={page.key}
                href={fullHref}
                className={cn(
                  "shrink-0 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                  isActive(page.href)
                    ? "border-primary text-primary"
                    : "border-transparent text-foreground/80 hover:border-muted-foreground/30 hover:text-foreground"
                )}
              >
                {page.title}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
