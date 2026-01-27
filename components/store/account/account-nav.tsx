"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Package, Heart, MapPin, Settings, Bell } from "lucide-react";

import { cn } from "@/lib/utils";

const accountNavItems = [
  { href: "", label: "Account", icon: User },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/addresses", label: "Addresses", icon: MapPin },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface AccountNavProps {
  baseUrl: string;
}

export function AccountNav({ baseUrl }: AccountNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    const fullPath = `${baseUrl}${href}`;
    // Exact match for the root account page
    if (href === "") {
      return pathname === baseUrl || pathname === `${baseUrl}/`;
    }
    // For other pages, check if pathname starts with the full path
    return pathname.startsWith(fullPath);
  };

  return (
    <nav className="w-full shrink-0 md:w-48 lg:w-56">
      {/* Mobile: horizontal tabs with underline */}
      <div className="flex overflow-x-auto scrollbar-none border-b pb-px -mb-px md:hidden">
        {accountNavItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={`${baseUrl}${item.href}`}
              className={cn(
                "flex shrink-0 items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-foreground/80 hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Tablet & Desktop: vertical sidebar navigation */}
      <ul className="hidden md:flex md:flex-col md:space-y-1">
        {accountNavItems.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={`${baseUrl}${item.href}`}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50",
                  active && "bg-muted"
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
