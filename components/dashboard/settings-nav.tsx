"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const settingsNavItems = [
  {
    title: "General",
    href: "/dashboard/settings",
    description: "Store name, description, and contact info",
  },
  {
    title: "Branding",
    href: "/dashboard/settings/branding",
    description: "Logo, colors, and visual identity",
  },
  {
    title: "Social Links",
    href: "/dashboard/settings/social",
    description: "Connect your social media accounts",
  },
  {
    title: "SEO",
    href: "/dashboard/settings/seo",
    description: "Search engine optimization settings",
  },
  {
    title: "Domains",
    href: "/dashboard/settings/domains",
    description: "Custom domain configuration",
  },
  {
    title: "Team",
    href: "/dashboard/settings/team",
    description: "Manage staff and collaborators",
  },
  {
    title: "Danger Zone",
    href: "/dashboard/settings/danger",
    description: "Delete or transfer store",
  },
];

export function SettingsNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard/settings") {
      return pathname === "/dashboard/settings";
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
            "flex flex-col rounded-md px-3 py-2 text-sm transition-colors",
            isActive(item.href)
              ? "bg-muted font-medium"
              : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
          )}
        >
          <span>{item.title}</span>
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

  const isActive = (href: string) => {
    if (href === "/dashboard/settings") {
      return pathname === "/dashboard/settings";
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
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
          )}
        >
          {item.title}
        </Link>
      ))}
    </nav>
  );
}
