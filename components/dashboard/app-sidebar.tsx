"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef, useMemo } from "react";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Image,
  ShoppingCart,
  BarChart3,
  Store,
  Warehouse,
  Star,
  Monitor,
  CreditCard,
  Tag,
  CalendarDays,
  Globe,
  Crown,
  ArrowRight,
  Link2,
  Wallet,
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

/**
 * Upgrade-to-Pro CTA shown in the sidebar footer for free / cancelled /
 * expired Pro stores. Hidden once the sidebar collapses to icon-only.
 */
function UpgradeCta({
  storeSlug,
  state,
}: {
  storeSlug: string;
  state: "expanded" | "collapsed";
}) {
  const subscription = useSubscription();

  // Wait for hydration before deciding anything
  if (!subscription) return null;

  // Already on active Pro — no nudge needed
  if (subscription.plan === "pro" && subscription.status === "active") {
    return null;
  }

  // When the sidebar is collapsed, render a tiny crown icon link
  if (state === "collapsed") {
    return (
      <Link
        href={`/dashboard/${storeSlug}/billing/upgrade`}
        className="mx-auto flex size-9 items-center justify-center rounded-md bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
        title="Upgrade to Pro"
      >
        <Crown className="size-4" />
      </Link>
    );
  }

  const headline =
    subscription.status === "cancelled"
      ? "Reactivate Pro"
      : subscription.status === "expired"
        ? "Renew Pro"
        : "Upgrade to Pro";

  const tagline =
    subscription.status === "trialing"
      ? subscription.daysRemainingInTrial
        ? `Trial: ${subscription.daysRemainingInTrial} day${subscription.daysRemainingInTrial !== 1 ? "s" : ""} left`
        : "Trial ending soon"
      : "Unlimited products + priority support";

  return (
    <Link
      href={`/dashboard/${storeSlug}/billing/upgrade`}
      className="group block rounded-lg border border-zinc-200 bg-zinc-900 text-white p-3 hover:bg-zinc-800 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1">
        <Crown className="size-3.5 text-amber-300" />
        <span className="text-xs font-semibold">{headline}</span>
        <ArrowRight className="ml-auto size-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="text-[11px] text-zinc-400 leading-tight">{tagline}</p>
    </Link>
  );
}

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
  const { state } = useSidebar();

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
  ];

  const salesNavItems = [
    {
      title: "Orders",
      href: `${baseUrl}/orders`,
      icon: ShoppingCart,
    },
    {
      title: "Global Order Map",
      href: `${baseUrl}/orders/map`,
      icon: Globe,
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

  // Growth items - marketing (owner/admin only)
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
    {
      title: "Links",
      href: `${baseUrl}/links`,
      icon: Link2,
    },
  ];

  // Check if user can access settings (owner or admin only)
  const showSettings = userRole === "owner" || userRole === "admin";
  // Only the owner sees billing
  const showBilling = userRole === "owner";

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

        {/* Account section - earnings, billing + settings */}
        {(showBilling || showSettings) && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Money coming in, next to the money going out. Same roles
                    as the page itself allows: admin or owner. */}
                {showSettings && storeSlug && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(`${baseUrl}/payments`)}
                      tooltip="Earnings"
                    >
                      <NavLink href={`${baseUrl}/payments`}>
                        <Wallet />
                        <span>Earnings</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {showBilling && storeSlug && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(`${baseUrl}/billing`)}
                      tooltip="Billing"
                    >
                      <NavLink href={`${baseUrl}/billing`}>
                        <CreditCard />
                        <span>Billing</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {showSettings && (
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
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        {showBilling && storeSlug && (
          <UpgradeCta storeSlug={storeSlug} state={state} />
        )}
        <UserNav user={user} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
