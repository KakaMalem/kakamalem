"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Image,
  ShoppingCart,
  Truck,
  BarChart3,
  Settings,
  Store,
  CreditCard,
  Layers,
  Warehouse,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { UserNav } from "./user-nav";
import { StoreSwitcher, type StoreInfo } from "./store-switcher";

interface AppSidebarProps {
  user: {
    email: string;
    fullName?: string;
    avatarUrl?: string;
  };
  stores?: StoreInfo[];
  currentStore?: StoreInfo | null;
  storeSlug?: string;
}

// Reserved paths that are not store slugs
const reservedPaths = new Set(["new", "account"]);

// Extract store slug from pathname
function getStoreSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/([^/]+)/);
  if (match && !reservedPaths.has(match[1])) {
    return match[1];
  }
  return null;
}

export function AppSidebar({
  user,
  stores = [],
  currentStore,
  storeSlug: initialStoreSlug,
}: AppSidebarProps) {
  const pathname = usePathname();

  // Derive store slug from URL for client-side navigation
  const storeSlug = useMemo(() => {
    const urlSlug = getStoreSlugFromPath(pathname);
    return urlSlug || initialStoreSlug;
  }, [pathname, initialStoreSlug]);

  // Build store-specific URL prefix
  const baseUrl = storeSlug ? `/dashboard/${storeSlug}` : "/dashboard";

  const isActive = (href: string) => {
    if (href === baseUrl) {
      return pathname === baseUrl;
    }
    return pathname.startsWith(href);
  };

  // Generate navigation items with store-specific URLs
  const mainNavItems = [
    {
      title: "Dashboard",
      href: baseUrl,
      icon: LayoutDashboard,
    },
    {
      title: "Products",
      href: `${baseUrl}/products`,
      icon: Package,
    },
    {
      title: "Categories",
      href: `${baseUrl}/categories`,
      icon: FolderTree,
    },
    {
      title: "Inventory",
      href: `${baseUrl}/inventory`,
      icon: Warehouse,
    },
    {
      title: "Variants",
      href: `${baseUrl}/variants`,
      icon: Layers,
    },
    {
      title: "Media",
      href: `${baseUrl}/media`,
      icon: Image,
    },
  ];

  const salesNavItems = [
    {
      title: "Orders",
      href: `${baseUrl}/orders`,
      icon: ShoppingCart,
    },
    {
      title: "Shipping",
      href: `${baseUrl}/shipping`,
      icon: Truck,
    },
  ];

  const insightsNavItems = [
    {
      title: "Analytics",
      href: `${baseUrl}/analytics`,
      icon: BarChart3,
    },
    {
      title: "Billing",
      href: `${baseUrl}/billing`,
      icon: CreditCard,
    },
  ];

  const settingsNavItems = [
    {
      title: "Store Settings",
      href: `${baseUrl}/settings`,
      icon: Store,
    },
    {
      title: "Account",
      href: "/dashboard/account",
      icon: Settings,
    },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <StoreSwitcher stores={stores} currentStore={currentStore} />
      </SidebarHeader>

      <SidebarSeparator className="mx-0 -mt-px" />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Sales</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {salesNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Insights</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {insightsNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <UserNav user={user} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
