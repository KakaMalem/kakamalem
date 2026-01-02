"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Image as ImageIcon,
  ShoppingCart,
  Truck,
  BarChart3,
  Settings,
  Store,
  CreditCard,
  ChevronLeft,
  Layers,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Navigation group definition
interface NavGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  description?: string;
}

// Navigation item definition
interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

// Navigation area (expanded content for each group)
interface NavArea {
  groupId: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    id: "main",
    title: "Store",
    icon: LayoutDashboard,
    description: "Dashboard & inventory",
  },
  {
    id: "sales",
    title: "Sales",
    icon: ShoppingCart,
    description: "Orders & fulfillment",
  },
  {
    id: "insights",
    title: "Insights",
    icon: BarChart3,
    description: "Analytics & reports",
  },
  {
    id: "settings",
    title: "Settings",
    icon: Settings,
    description: "Store configuration",
  },
];

const navAreas: NavArea[] = [
  {
    groupId: "main",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Products", href: "/dashboard/products", icon: Package },
      { title: "Categories", href: "/dashboard/categories", icon: FolderTree },
      { title: "Inventory", href: "/dashboard/inventory", icon: Warehouse },
      { title: "Variants", href: "/dashboard/variants", icon: Layers },
      { title: "Media", href: "/dashboard/media", icon: ImageIcon },
    ],
  },
  {
    groupId: "sales",
    items: [
      { title: "Orders", href: "/dashboard/orders", icon: ShoppingCart },
      { title: "Shipping", href: "/dashboard/shipping", icon: Truck },
    ],
  },
  {
    groupId: "insights",
    items: [
      { title: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
      { title: "Billing", href: "/dashboard/billing", icon: CreditCard },
    ],
  },
  {
    groupId: "settings",
    items: [
      { title: "Store Settings", href: "/dashboard/settings", icon: Store },
      { title: "Account", href: "/dashboard/account", icon: Settings },
    ],
  },
];

export type StoreInfo = {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
};

interface TwoColumnSidebarProps {
  user: {
    email: string;
    fullName?: string;
    avatarUrl?: string;
  };
  stores?: StoreInfo[];
  currentStore?: StoreInfo | null;
  className?: string;
}

export function TwoColumnSidebar({
  user,
  currentStore,
  className,
}: TwoColumnSidebarProps) {
  const pathname = usePathname();
  const [activeGroup, setActiveGroup] = React.useState<string>("main");
  const [isExpanded, setIsExpanded] = React.useState(true);

  // Determine active group based on pathname
  React.useEffect(() => {
    const currentArea = navAreas.find((area) =>
      area.items.some((item) => {
        if (item.href === "/dashboard") {
          return pathname === "/dashboard";
        }
        return pathname.startsWith(item.href);
      })
    );
    if (currentArea) {
      setActiveGroup(currentArea.groupId);
    }
  }, [pathname]);

  const isItemActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  const activeArea = navAreas.find((area) => area.groupId === activeGroup);

  const userInitials = user.fullName
    ? user.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase();

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          "flex h-svh border-r bg-sidebar transition-all duration-200",
          isExpanded ? "w-70" : "w-16",
          className
        )}
      >
        {/* Icon strip (always visible) */}
        <div className="flex w-16 shrink-0 flex-col items-center border-r bg-sidebar py-3">
          {/* Store logo */}
          <div className="mb-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard"
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"
                >
                  {currentStore?.logoUrl ? (
                    <Image
                      src={currentStore.logoUrl}
                      alt={currentStore.name}
                      width={24}
                      height={24}
                      className="rounded object-cover"
                    />
                  ) : (
                    <Store className="h-5 w-5" />
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                {currentStore?.name || "Dashboard"}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Nav groups */}
          <div className="flex flex-1 flex-col gap-1">
            {navGroups.map((group) => (
              <Tooltip key={group.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      setActiveGroup(group.id);
                      if (!isExpanded) setIsExpanded(true);
                    }}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                      activeGroup === group.id
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                    )}
                  >
                    <group.icon className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex flex-col gap-0.5">
                  <span className="font-medium">{group.title}</span>
                  {group.description && (
                    <span className="text-xs text-muted-foreground">
                      {group.description}
                    </span>
                  )}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* User avatar at bottom */}
          <div className="mt-auto pt-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/dashboard/account">
                  <Avatar className="h-9 w-9">
                    <AvatarImage
                      src={user.avatarUrl}
                      alt={user.fullName || user.email}
                    />
                    <AvatarFallback className="text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <span>{user.fullName || user.email}</span>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Expanded area (collapsible) */}
        <div
          className={cn(
            "flex flex-col overflow-hidden transition-all duration-200",
            isExpanded ? "w-54 opacity-100" : "w-0 opacity-0"
          )}
        >
          {/* Group title header */}
          <div className="flex h-14 items-center justify-between border-b px-4">
            <h2 className="text-sm font-semibold text-foreground">
              {navGroups.find((g) => g.id === activeGroup)?.title}
            </h2>
            <button
              onClick={() => setIsExpanded(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation items */}
          <nav className="flex-1 overflow-y-auto p-2">
            <ul className="space-y-1">
              {activeArea?.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      isItemActive(item.href)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Store name footer */}
          {currentStore && (
            <div className="border-t p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Store className="h-3 w-3" />
                <span className="truncate">{currentStore.name}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
