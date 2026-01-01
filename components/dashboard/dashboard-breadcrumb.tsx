"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// Map path segments to human-readable labels
const segmentLabels: Record<string, string> = {
  dashboard: "Dashboard",
  products: "Products",
  categories: "Categories",
  media: "Media",
  orders: "Orders",
  shipping: "Shipping",
  analytics: "Analytics",
  billing: "Billing",
  settings: "Settings",
  account: "Account",
  new: "New",
  edit: "Edit",
  // Settings sub-pages
  branding: "Branding",
  social: "Social Links",
  seo: "SEO",
  domains: "Domains",
  team: "Team",
  danger: "Danger Zone",
};

export function DashboardBreadcrumb() {
  const pathname = usePathname();

  // Split pathname and filter empty strings
  const segments = pathname.split("/").filter(Boolean);

  // Build breadcrumb items
  const breadcrumbItems = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const isLast = index === segments.length - 1;

    // Try to get a human-readable label, otherwise capitalize the segment
    const label =
      segmentLabels[segment] ||
      segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");

    return {
      href,
      label,
      isLast,
    };
  });

  // If we only have "dashboard", don't show breadcrumbs
  if (breadcrumbItems.length <= 1) {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbItems.map((item, index) => (
          <Fragment key={item.href}>
            <BreadcrumbItem className={index === 0 ? "hidden md:block" : ""}>
              {item.isLast ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {!item.isLast && (
              <BreadcrumbSeparator
                className={index === 0 ? "hidden md:block" : ""}
              />
            )}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
