"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

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

  const settingsNavItems = [
    {
      title: "General",
      href: baseUrl,
      description: "Store name, description, and contact info",
    },
    {
      title: "Branding",
      href: `${baseUrl}/branding`,
      description: "Logo, colors, and visual identity",
    },
    {
      title: "Social Links",
      href: `${baseUrl}/social`,
      description: "Connect your social media accounts",
    },
    {
      title: "SEO",
      href: `${baseUrl}/seo`,
      description: "Search engine optimization settings",
    },
    {
      title: "Domains",
      href: `${baseUrl}/domains`,
      description: "Custom domain configuration",
    },
    {
      title: "Team",
      href: `${baseUrl}/team`,
      description: "Manage staff and collaborators",
    },
    {
      title: "Delivery & Shipping",
      href: `${baseUrl}/delivery`,
      description: "Delivery zones, rates, and shipping options",
    },
    {
      title: "Danger Zone",
      href: `${baseUrl}/danger`,
      description: "Delete or transfer store",
    },
  ];

  const isActive = (href: string) => {
    if (href === baseUrl) {
      return pathname === baseUrl;
    }
    return pathname === href;
  };

  return (
    <nav className="flex flex-col space-y-1">
      {settingsNavItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex flex-col rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/50",
            isActive(item.href) && "bg-muted"
          )}
        >
          <span
            className={cn(
              "font-medium",
              !isActive(item.href) && "text-foreground/80"
            )}
          >
            {item.title}
          </span>
          <span className="text-xs text-muted-foreground font-normal">
            {item.description}
          </span>
        </Link>
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

  const settingsNavItems = [
    { title: "General", href: baseUrl },
    { title: "Branding", href: `${baseUrl}/branding` },
    { title: "Social Links", href: `${baseUrl}/social` },
    { title: "SEO", href: `${baseUrl}/seo` },
    { title: "Domains", href: `${baseUrl}/domains` },
    { title: "Team", href: `${baseUrl}/team` },
    { title: "Delivery & Shipping", href: `${baseUrl}/delivery` },
    { title: "Danger Zone", href: `${baseUrl}/danger` },
  ];

  const isActive = (href: string) => {
    if (href === baseUrl) {
      return pathname === baseUrl;
    }
    return pathname === href;
  };

  return (
    <nav className="flex overflow-x-auto border-b pb-px -mb-px">
      {settingsNavItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            isActive(item.href)
              ? "border-primary text-primary"
              : "border-transparent text-foreground/80 hover:text-foreground hover:border-muted-foreground/30"
          )}
        >
          {item.title}
        </Link>
      ))}
    </nav>
  );
}
