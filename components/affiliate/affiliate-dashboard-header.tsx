"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { usePathname } from "next/navigation";

const pathTitles: Record<string, string> = {
  "/affiliate/dashboard": "Dashboard",
  "/affiliate/dashboard/link": "My Link",
  "/affiliate/dashboard/referrals": "Referrals",
  "/affiliate/dashboard/earnings": "Earnings",
  "/affiliate/dashboard/payouts": "Payouts",
  "/affiliate/dashboard/profile": "Profile",
};

export function AffiliateDashboardHeader() {
  const pathname = usePathname();
  const pageTitle = pathTitles[pathname] || "Dashboard";

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink href="/affiliate/dashboard">
              Affiliate
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden md:block" />
          <BreadcrumbItem>
            <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
