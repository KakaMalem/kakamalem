"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { DashboardBreadcrumb } from "./dashboard-breadcrumb";

// Reserved dashboard paths that are not store slugs
const reservedPaths = new Set(["new", "account"]);

// Extract store slug from pathname like /dashboard/my-store/...
function getStoreSlugFromPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  // Store slug is the second segment (index 1) after "dashboard"
  if (segments[0] === "dashboard" && segments[1] && !reservedPaths.has(segments[1])) {
    return segments[1];
  }
  return null;
}

interface DashboardHeaderProps {
  children?: React.ReactNode;
}

export function DashboardHeader({ children }: DashboardHeaderProps) {
  const pathname = usePathname();
  const storeSlug = getStoreSlugFromPath(pathname);

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <DashboardBreadcrumb />
      <div className="flex-1" />
      {storeSlug && (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/store/${storeSlug}`} target="_blank">
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">View Store</span>
          </Link>
        </Button>
      )}
      {children}
    </header>
  );
}
