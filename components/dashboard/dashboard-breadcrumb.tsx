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
  edit: "Edit",
  // Settings sub-pages
  branding: "Branding",
  social: "Social Links",
  seo: "SEO",
  domains: "Domains",
  team: "Team",
  danger: "Danger Zone",
};

// Reserved dashboard paths that are not store slugs
const reservedPaths = new Set(["new", "account"]);

// Truncate long segments (like UUIDs) to a max length
function truncateLabel(label: string, maxLength: number = 12): string {
  if (label.length <= maxLength) return label;
  return label.slice(0, maxLength) + "…";
}

// Check if a segment is a store slug (second segment after dashboard, not a reserved path)
function isStoreSlug(
  segment: string,
  index: number,
  segments: string[]
): boolean {
  return (
    index === 1 &&
    segments[0] === "dashboard" &&
    !reservedPaths.has(segment) &&
    !segmentLabels[segment]
  );
}

export function DashboardBreadcrumb() {
  const pathname = usePathname();

  // Split pathname and filter empty strings
  const segments = pathname.split("/").filter(Boolean);

  // Find store slug if present (for building correct hrefs)
  const storeSlugIndex = segments.findIndex((seg, idx) =>
    isStoreSlug(seg, idx, segments)
  );
  const storeSlug = storeSlugIndex !== -1 ? segments[storeSlugIndex] : null;

  // Build breadcrumb items, skipping the store slug segment
  const breadcrumbItems: { href: string; label: string; isLast: boolean }[] =
    [];

  segments.forEach((segment, index) => {
    // Skip the store slug - it's shown in the store switcher
    if (isStoreSlug(segment, index, segments)) {
      return;
    }

    // Build href - need to include store slug in path for proper navigation
    const href = "/" + segments.slice(0, index + 1).join("/");

    // For "dashboard" segment when we have a store, link to /dashboard/[slug]
    let adjustedHref = href;
    if (segment === "dashboard" && storeSlug) {
      adjustedHref = `/dashboard/${storeSlug}`;
    }

    // Check if this is the last visible item
    const remainingSegments = segments
      .slice(index + 1)
      .filter((seg, idx) => !isStoreSlug(seg, index + 1 + idx, segments));
    const isLast = remainingSegments.length === 0;

    // Try to get a human-readable label, otherwise capitalize and truncate the segment
    const rawLabel =
      segmentLabels[segment] ||
      segment.charAt(0).toUpperCase() + segment.slice(1);
    const label = segmentLabels[segment] ? rawLabel : truncateLabel(rawLabel);

    breadcrumbItems.push({
      href: adjustedHref,
      label,
      isLast,
    });
  });

  // If we only have "Dashboard", don't show breadcrumbs
  if (breadcrumbItems.length <= 1) {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbItems.map((item, index) => (
          <Fragment key={item.href}>
            <BreadcrumbItem
              className={`${
                index === 0 ? "hidden md:block" : ""
              } font-extrabold text-lg`}
            >
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
