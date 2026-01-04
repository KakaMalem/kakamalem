import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { DashboardBreadcrumb } from "./dashboard-breadcrumb";

interface DashboardHeaderProps {
  storeSlug?: string;
  children?: React.ReactNode;
}

export function DashboardHeader({ storeSlug, children }: DashboardHeaderProps) {
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
