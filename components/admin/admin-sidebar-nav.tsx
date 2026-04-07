"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Store,
  Users,
  Settings,
  Handshake,
  Receipt,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminSidebarNav({
  affiliateBadge = 0,
}: {
  affiliateBadge?: number;
}) {
  const pathname = usePathname();

  const navItems = [
    { href: "/admin", icon: LayoutDashboard, label: "Dashboard", badge: 0 },
    { href: "/admin/stores", icon: Store, label: "Stores", badge: 0 },
    { href: "/admin/users", icon: Users, label: "Users", badge: 0 },
    {
      href: "/admin/payments",
      icon: Receipt,
      label: "Payments",
      badge: 0,
    },
    {
      href: "/admin/disputes",
      icon: ShieldAlert,
      label: "Disputes",
      badge: 0,
    },
    {
      href: "/admin/affiliates",
      icon: Handshake,
      label: "Affiliates",
      badge: affiliateBadge,
    },
    { href: "/admin/settings", icon: Settings, label: "Settings", badge: 0 },
  ];

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="flex flex-col gap-1 p-4">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive(item.href)
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <span className="flex items-center gap-3">
            <item.icon className="size-4" />
            {item.label}
          </span>
          {item.badge > 0 && (
            <Badge
              variant="destructive"
              className="size-5 items-center justify-center rounded-full p-0 text-xs"
            >
              {item.badge}
            </Badge>
          )}
        </Link>
      ))}
    </nav>
  );
}
