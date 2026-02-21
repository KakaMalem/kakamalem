"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef, useMemo } from "react";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Image,
  Paintbrush,
  ShoppingCart,
  BarChart3,
  Store,
  Warehouse,
  Star,
  Monitor,
  Wallet,
  Tag,
  CalendarDays,
  Crown,
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
  useSidebar,
} from "@/components/ui/sidebar";
import { UserNav } from "./user-nav";
import { StoreSwitcher, type StoreInfo } from "./store-switcher";
import { Progress } from "@/components/ui/progress";
import { UpgradeButton } from "@/components/dashboard/billing/upgrade-button";
import { useSubscription } from "@/lib/stores/use-subscription-store";

// NavLink component that closes mobile sidebar on navigation
// Uses forwardRef to properly work with SidebarMenuButton's asChild prop
const NavLink = forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<typeof Link>
>(({ onClick, ...props }, ref) => {
  const { setOpenMobile, isMobile } = useSidebar();

  return (
    <Link
      ref={ref}
      onClick={(e) => {
        if (isMobile) {
          setOpenMobile(false);
        }
        onClick?.(e);
      }}
      {...props}
    />
  );
});
NavLink.displayName = "NavLink";

interface AppSidebarProps {
  user: {
    id: string;
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

// Extract store slug from pathname (handles URL-encoded Unicode slugs)
function getStoreSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/([^/]+)/);
  if (match && !reservedPaths.has(match[1])) {
    // Decode URL encoding for Unicode slugs (e.g., %D9%86%D9%88%D9%86 -> نون)
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
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

  // Derive current store data from stores array for client-side navigation
  const currentStoreData = useMemo(() => {
    if (storeSlug) {
      return stores.find((s) => s.slug === storeSlug) ?? null;
    }
    return currentStore ?? null;
  }, [storeSlug, stores, currentStore]);

  // Derive posEnabled and userRole from current store
  const posEnabled = currentStoreData?.posEnabled ?? true;
  const userRole = currentStoreData?.userRole ?? null;

  // Build store-specific URL prefix
  const baseUrl = storeSlug ? `/dashboard/${storeSlug}` : "/dashboard";

  // Check if user can access settings (owner or admin only)
  const showSettings = userRole === "owner" || userRole === "admin";

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
      title: "Media",
      href: `${baseUrl}/media`,
      icon: Image,
    },
    ...(showSettings
      ? [
          {
            title: "Customize",
            href: `${baseUrl}/customize`,
            icon: Paintbrush,
          },
        ]
      : []),
  ];

  const salesNavItems = [
    {
      title: "Orders",
      href: `${baseUrl}/orders`,
      icon: ShoppingCart,
    },
    ...(posEnabled
      ? [
          {
            title: "POS",
            href: `${baseUrl}/pos`,
            icon: Monitor,
          },
        ]
      : []),
  ];

  const insightsNavItems = [
    {
      title: "Analytics",
      href: `${baseUrl}/analytics`,
      icon: BarChart3,
    },
    {
      title: "Reviews",
      href: `${baseUrl}/reviews`,
      icon: Star,
    },
  ];

  // Growth items - marketing + earnings (owner/admin only)
  const growthNavItems = [
    {
      title: "Sale Campaigns",
      href: `${baseUrl}/campaigns`,
      icon: CalendarDays,
    },
    {
      title: "Promo Codes",
      href: `${baseUrl}/coupons`,
      icon: Tag,
    },
    ...(userRole === "owner"
      ? [
          {
            title: "Earnings",
            href: `${baseUrl}/earnings`,
            icon: Wallet,
          },
        ]
      : []),
  ];

  // Subscription info for upgrade section
  const subscription = useSubscription();
  const isPro = subscription?.plan === "pro";
  const showUpgrade = subscription && !isPro && storeSlug;
  const productUsagePercent =
    subscription?.productLimit && subscription.productLimit > 0
      ? (subscription.productCount / subscription.productLimit) * 100
      : 0;
  const showTrialInfo =
    subscription?.status === "trialing" &&
    subscription?.daysRemainingInTrial !== null;

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
                    <NavLink href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
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
                    <NavLink href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
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
                    <NavLink href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Growth section - campaigns, promos, earnings */}
        {showSettings && (
          <SidebarGroup>
            <SidebarGroupLabel>Growth</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {growthNavItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.title}
                    >
                      <NavLink href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Settings - single item, no section label needed */}
        {showSettings && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(`${baseUrl}/settings`)}
                    tooltip="Store Settings"
                  >
                    <NavLink href={`${baseUrl}/settings`}>
                      <Store />
                      <span>Store Settings</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Upgrade section - shows when on Free plan */}
      {showUpgrade && (
        <>
          <SidebarSeparator className="mx-0" />
          <div className="p-3 group-data-[collapsible=icon]:hidden">
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">Free Plan</span>
                {showTrialInfo && (
                  <span className="text-xs text-muted-foreground">
                    {subscription.daysRemainingInTrial}d left
                  </span>
                )}
              </div>

              {/* Product usage */}
              {subscription.productLimit !== null && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Products</span>
                    <span className="font-medium">
                      {subscription.productCount}/{subscription.productLimit}
                    </span>
                  </div>
                  <Progress value={productUsagePercent} className="h-1.5" />
                </div>
              )}

              <UpgradeButton storeSlug={storeSlug} className="w-full" size="sm">
                <Crown className="mr-1.5 size-3.5" />
                Upgrade to Pro
              </UpgradeButton>
            </div>
          </div>
        </>
      )}

      <SidebarFooter>
        <UserNav user={user} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
