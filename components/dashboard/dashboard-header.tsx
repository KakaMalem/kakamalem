"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
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

// Extract store slug from pathname
function getStoreSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/([^/]+)/);
  if (match && !reservedPaths.has(match[1])) {
    return match[1];
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
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/store/${storeSlug}`} target="_blank">
                <ExternalLink className="h-5 w-5" />
                <span className="sr-only">View Store</span>
              </Link>
            </Button>
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
