"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/lib/stores/use-user-role-store";
import {
  SETTINGS_PAGES,
  canAccessSettingsPage,
} from "@/lib/config/settings-permissions";

// Extract store slug from pathname like /dashboard/my-store/settings
function getStoreSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/([^/]+)/);
  if (match && match[1] !== "new" && match[1] !== "account") {
    return match[1];
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
  const accessiblePages = SETTINGS_PAGES.filter((page) =>
    canAccessSettingsPage(userRole, page.key)
  );

  const isActive = (href: string) => {
    const fullHref = href ? `${baseUrl}${href}` : baseUrl;
    if (fullHref === baseUrl) {
      return pathname === baseUrl;
    }
    return pathname === fullHref;
  };

  return (
    <nav className="flex flex-col space-y-1">
      {accessiblePages.map((page) => {
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
            <span className="text-xs text-muted-foreground font-normal">
              {page.description}
            </span>
          </Link>
        );
      })}
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
  const accessiblePages = SETTINGS_PAGES.filter((page) =>
    canAccessSettingsPage(userRole, page.key)
  );

  const isActive = (href: string) => {
    const fullHref = href ? `${baseUrl}${href}` : baseUrl;
    if (fullHref === baseUrl) {
      return pathname === baseUrl;
    }
    return pathname === fullHref;
  };

  return (
    <nav className="flex overflow-x-auto scrollbar-none border-b pb-px -mb-px">
      {accessiblePages.map((page) => {
        const fullHref = page.href ? `${baseUrl}${page.href}` : baseUrl;
        return (
          <Link
            key={page.key}
            href={fullHref}
            className={cn(
              "shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              isActive(page.href)
                ? "border-primary text-primary"
                : "border-transparent text-foreground/80 hover:text-foreground hover:border-muted-foreground/30"
            )}
          >
            {page.title}
          </Link>
        );
      })}
    </nav>
  );
}
