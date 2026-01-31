"use client";

import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DashboardBreadcrumb } from "./dashboard-breadcrumb";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useStoreMode } from "@/lib/stores/use-tenant-settings-store";

interface DashboardHeaderProps {
  children?: React.ReactNode;
}

// Reserved paths that are not store slugs
const reservedPaths = new Set(["new", "account"]);

// Extract store slug from pathname (handles URL-encoded Unicode slugs)
function getStoreSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/([^/]+)/);
  if (match && !reservedPaths.has(match[1])) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return null;
}

export function DashboardHeader({ children }: DashboardHeaderProps) {
  const pathname = usePathname();
  const storeSlug = getStoreSlugFromPath(pathname);
  const storeMode = useStoreMode();

  // Hide "Visit Website" link for POS-only stores (no online storefront)
  const showVisitWebsiteLink = storeSlug && storeMode !== "offline_only";

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <DashboardBreadcrumb />
      <div className="flex-1" />
      <NotificationBell context="owner" />
      {showVisitWebsiteLink && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => {
                // Open in external browser - empty features string is the recommended
                // workaround for PWAs to open links outside the app context
                // See: https://github.com/pwa-builder/PWABuilder-CLI/issues/261
                const url = `${window.location.origin}/store/${storeSlug}`;
                window.open(url, "_blank", "");
              }}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-9 w-9"
            >
              <ExternalLink className="h-5 w-5" />
              <span className="sr-only">View Store</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>View Store</p>
          </TooltipContent>
        </Tooltip>
      )}
      {children}
    </header>
  );
}
