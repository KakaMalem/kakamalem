"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, Settings, User, Crown } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { signOut } from "@/lib/auth/actions";
import type { SubscriptionOverview } from "@/lib/db/queries/billing";

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

interface UserNavProps {
  user: {
    email: string;
    fullName?: string;
    avatarUrl?: string;
  };
  subscription?: SubscriptionOverview | null;
}

export function UserNav({ user, subscription }: UserNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const [isMounted, setIsMounted] = React.useState(false);

  // Wait for client-side mount to avoid hydration mismatch with Radix IDs
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Derive store slug from URL for client-side navigation
  const storeSlug = React.useMemo(() => {
    return getStoreSlugFromPath(pathname);
  }, [pathname]);

  // Build store-specific URL prefix
  const baseUrl = storeSlug ? `/dashboard/${storeSlug}` : "/dashboard";

  const initials = user.fullName
    ? user.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase();

  const closeSidebarOnMobile = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleSignOut = async () => {
    closeSidebarOnMobile();
    await signOut();
    router.push("/login");
  };

  // Calculate usage percentages
  const isPro = subscription?.plan === "pro";
  const productUsagePercent =
    subscription?.productLimit && subscription.productLimit > 0
      ? (subscription.productCount / subscription.productLimit) * 100
      : 0;
  const trialUsagePercent =
    subscription?.status === "trialing" &&
    subscription.trialDurationDays > 0 &&
    subscription.daysRemainingInTrial !== null
      ? ((subscription.trialDurationDays - subscription.daysRemainingInTrial) /
          subscription.trialDurationDays) *
        100
      : 0;
  const showUpgrade = subscription && !isPro;
  const showProductLimit = subscription?.productLimit !== null;
  const showTrialInfo =
    subscription?.status === "trialing" &&
    subscription?.daysRemainingInTrial !== null;
  const showUsageSection =
    subscription &&
    storeSlug &&
    (showProductLimit || showTrialInfo || showUpgrade);

  // Show skeleton until mounted to avoid hydration mismatch
  if (!isMounted) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="pointer-events-none">
            <div className="h-8 w-8 rounded-lg bg-muted" />
            <div className="grid flex-1 gap-1">
              <div className="h-4 w-20 bg-muted rounded" />
              <div className="h-3 w-24 bg-muted rounded" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage
                  src={user.avatarUrl}
                  alt={user.fullName || user.email}
                />
                <AvatarFallback className="rounded-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {user.fullName || "User"}
                </span>
                <span className="truncate text-xs text-muted-foreground flex items-center gap-1">
                  {isPro ? (
                    <>
                      <Crown className="size-3 text-primary" />
                      Pro Plan
                    </>
                  ) : (
                    "Free Plan"
                  )}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-64 rounded-lg"
            side="top"
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage
                    src={user.avatarUrl}
                    alt={user.fullName || user.email}
                  />
                  <AvatarFallback className="rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {user.fullName || "User"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground flex items-center gap-1">
                    {isPro ? (
                      <>
                        <Crown className="size-3 text-primary" />
                        Pro Plan
                      </>
                    ) : (
                      "Free Plan"
                    )}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>

            {/* Usage Section */}
            {showUsageSection && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Usage
                  </p>

                  {/* Product Limit */}
                  {subscription.productLimit !== null && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Products</span>
                        <span className="font-medium">
                          {subscription.productCount}/
                          {subscription.productLimit}
                        </span>
                      </div>
                      <Progress value={productUsagePercent} className="h-1.5" />
                    </div>
                  )}

                  {/* Trial Time */}
                  {subscription.status === "trialing" &&
                    subscription.daysRemainingInTrial !== null && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">
                            Trial ends in
                          </span>
                          <span className="font-medium">
                            {subscription.daysRemainingInTrial} day
                            {subscription.daysRemainingInTrial !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <Progress value={trialUsagePercent} className="h-1.5" />
                      </div>
                    )}

                  {/* Get Pro Button */}
                  {showUpgrade && (
                    <Button size="sm" className="w-full" asChild>
                      <Link
                        href={`${baseUrl}/billing`}
                        onClick={closeSidebarOnMobile}
                      >
                        <Crown className="mr-1.5 size-3.5" />
                        Get Pro
                      </Link>
                    </Button>
                  )}
                </div>
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild onClick={closeSidebarOnMobile}>
                <Link href="/dashboard/account">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              {storeSlug && (
                <DropdownMenuItem asChild onClick={closeSidebarOnMobile}>
                  <Link href={`${baseUrl}/settings`}>
                    <Settings className="mr-2 h-4 w-4" />
                    Store Settings
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
