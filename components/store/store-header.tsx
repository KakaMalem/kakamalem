"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useTransition } from "react";
import {
  ShoppingCart,
  Search,
  LogOut,
  LayoutDashboard,
  User,
  Heart,
  Package,
  Crown,
  Shield,
  Bell,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";
import { Badge } from "@/components/ui/badge";
import { CartBadge, useHydratedCartCount } from "@/components/store/cart-badge";
import { cartActions } from "@/lib/stores/use-cart-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import type { Tenant } from "@/lib/db/schema";
import type { StoreRole } from "@/lib/auth/context";

interface StoreHeaderProps {
  store: Tenant;
  cartItemCount?: number;
  user?: { name?: string; email?: string; avatarUrl?: string } | null;
  userContext?: {
    isOwner: boolean;
    isStaff: boolean;
    isMember: boolean;
    role: StoreRole;
  } | null;
}

export function StoreHeader({
  store,
  cartItemCount = 0,
  user,
  userContext,
}: StoreHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [isSearching, startSearchTransition] = useTransition();

  // Get hydrated cart count that syncs with Zustand store
  const hydratedCartCount = useHydratedCartCount(cartItemCount);

  // Check if online cart should be disabled
  // - catalog: Display only, no checkout anywhere
  // - offline_only: POS only, no online checkout
  const isCartDisabled =
    store.storeMode === "catalog" || store.storeMode === "offline_only";

  const storeUrl = `/store/${store.slug}`;

  // Determine what to show in the header based on headerDisplay setting
  // Only show logo if the setting enables it AND a logo URL exists
  const hasLogo = Boolean(store.logoUrl);
  const showLogo =
    hasLogo &&
    (store.headerDisplay === "logo_only" ||
      store.headerDisplay === "logo_and_name");
  // Show name if setting enables it, OR if logo_only is set but no logo exists (fallback)
  const showName =
    store.headerDisplay === "name_only" ||
    store.headerDisplay === "logo_and_name" ||
    (store.headerDisplay === "logo_only" && !hasLogo);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = searchQuery.trim();
      if (trimmed) {
        startSearchTransition(() => {
          router.push(`${storeUrl}?q=${encodeURIComponent(trimmed)}`);
        });
      } else {
        startSearchTransition(() => {
          router.push(storeUrl);
        });
      }
    },
    [searchQuery, storeUrl, router]
  );

  const handleSignOut = () => {
    router.push(`${storeUrl}/logout`);
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "U";
  };

  const userInitials = getInitials(user?.name, user?.email);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Desktop & Tablet Header */}
        <div className="hidden h-16 items-center gap-3 md:flex lg:gap-6">
          {/* Left: Logo / Store Name */}
          <Link
            href={storeUrl}
            className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80 lg:gap-2.5"
          >
            {showLogo && (
              <Logo
                logoUrl={store.logoUrl}
                alt={store.name}
                size="lg"
                priority
              />
            )}
            {showName && (
              <span className="max-w-32 truncate text-base font-semibold tracking-tight lg:max-w-none lg:text-lg">
                {store.name}
              </span>
            )}
          </Link>

          {/* Center: Search Bar */}
          <form onSubmit={handleSearch} className="flex flex-1 justify-center">
            <div className="relative w-full max-w-md lg:max-w-lg">
              <Search
                className={cn(
                  "absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors pointer-events-none",
                  isSearching && "animate-pulse"
                )}
              />
              <Input
                type="search"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 pl-10 pr-4 focus-visible:bg-background"
                aria-label="Search products"
              />
            </div>
          </form>

          {/* Right: Actions */}
          <div className="flex shrink-0 items-center gap-1 lg:gap-2">
            {/* Cart Button - Hidden in catalog mode */}
            {!isCartDisabled && (
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => cartActions.setIsOpen(true)}
                aria-label={`Shopping cart with ${hydratedCartCount} items`}
              >
                <ShoppingCart className="size-5" />
                <CartBadge initialCount={cartItemCount} />
              </Button>
            )}

            {/* Auth - Desktop */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-full"
                    aria-label="Account menu"
                  >
                    <Avatar className="size-8">
                      {user.avatarUrl && (
                        <AvatarImage
                          src={user.avatarUrl}
                          alt={user.name || "User"}
                        />
                      )}
                      <AvatarFallback className="text-xs">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {user.name || "User"}
                      </p>
                      {userContext?.isOwner && (
                        <Badge
                          variant="secondary"
                          className="h-5 gap-0.5 text-[10px] px-1.5"
                        >
                          <Crown className="size-2.5" />
                          Owner
                        </Badge>
                      )}
                      {userContext?.isStaff && !userContext?.isOwner && (
                        <Badge
                          variant="outline"
                          className="h-5 gap-0.5 text-[10px] px-1.5"
                        >
                          <Shield className="size-2.5" />
                          {userContext.role === "admin" ? "Admin" : "Staff"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  {/* Customer Account Links */}
                  <DropdownMenuItem asChild>
                    <Link href={`${storeUrl}/account`}>
                      <User className="mr-2 size-4" />
                      My Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`${storeUrl}/account/orders`}>
                      <Package className="mr-2 size-4" />
                      My Orders
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`${storeUrl}/account/wishlist`}>
                      <Heart className="mr-2 size-4" />
                      Wishlist
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`${storeUrl}/account/notifications`}>
                      <Bell className="mr-2 size-4" />
                      Notifications
                    </Link>
                  </DropdownMenuItem>
                  {/* Owner/Staff Dashboard Link */}
                  {userContext?.isMember && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/${store.slug}`}>
                          <LayoutDashboard className="mr-2 size-4" />
                          Store Dashboard
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`${storeUrl}/auth/login`}>Sign in</Link>
                </Button>
                <Button size="sm" asChild className="hidden lg:inline-flex">
                  <Link href={`${storeUrl}/auth/signup`}>Register</Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Header */}
        <div className="flex flex-col gap-3 py-3 md:hidden">
          {/* Top Row: Logo, Cart, Profile */}
          <div className="flex items-center justify-between">
            {/* Left: Logo / Store Name */}
            <Link
              href={storeUrl}
              className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80"
            >
              {showLogo && (
                <Logo
                  logoUrl={store.logoUrl}
                  alt={store.name}
                  size="md"
                  priority
                />
              )}
              {showName && (
                <span className="max-w-40 truncate text-base font-semibold tracking-tight">
                  {store.name}
                </span>
              )}
            </Link>

            {/* Right: Cart, Notifications & Profile */}
            <div className="flex items-center gap-0.5">
              {/* Cart Button - Hidden in catalog mode */}
              {!isCartDisabled && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative size-9"
                  onClick={() => cartActions.setIsOpen(true)}
                  aria-label={`Shopping cart with ${hydratedCartCount} items`}
                >
                  <ShoppingCart className="size-5" />
                  <CartBadge initialCount={cartItemCount} />
                </Button>
              )}

              {/* Profile/Auth - Mobile */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-full"
                    aria-label={
                      user ? "Account menu" : "Sign in or create account"
                    }
                  >
                    {user ? (
                      <Avatar className="size-7">
                        {user.avatarUrl && (
                          <AvatarImage
                            src={user.avatarUrl}
                            alt={user.name || "User"}
                          />
                        )}
                        <AvatarFallback className="text-xs">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="flex size-7 items-center justify-center rounded-full bg-muted">
                        <User className="size-4 text-muted-foreground" />
                      </div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {user ? (
                    <>
                      <div className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">
                            {user.name || "User"}
                          </p>
                          {userContext?.isOwner && (
                            <Badge
                              variant="secondary"
                              className="h-5 gap-0.5 text-[10px] px-1.5"
                            >
                              <Crown className="size-2.5" />
                              Owner
                            </Badge>
                          )}
                          {userContext?.isStaff && !userContext?.isOwner && (
                            <Badge
                              variant="outline"
                              className="h-5 gap-0.5 text-[10px] px-1.5"
                            >
                              <Shield className="size-2.5" />
                              {userContext.role === "admin" ? "Admin" : "Staff"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                      <DropdownMenuSeparator />
                      {/* Customer Account Links */}
                      <DropdownMenuItem asChild>
                        <Link href={`${storeUrl}/account`}>
                          <User className="mr-2 size-4" />
                          My Account
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`${storeUrl}/account/orders`}>
                          <Package className="mr-2 size-4" />
                          My Orders
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`${storeUrl}/account/wishlist`}>
                          <Heart className="mr-2 size-4" />
                          Wishlist
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`${storeUrl}/account/notifications`}>
                          <Bell className="mr-2 size-4" />
                          Notifications
                        </Link>
                      </DropdownMenuItem>
                      {/* Owner/Staff Dashboard Link */}
                      {userContext?.isMember && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/${store.slug}`}>
                              <LayoutDashboard className="mr-2 size-4" />
                              Store Dashboard
                            </Link>
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleSignOut}
                        className="text-destructive focus:text-destructive"
                      >
                        <LogOut className="mr-2 size-4" />
                        Sign out
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <div className="p-2">
                      <p className="mb-1 text-sm font-medium">Welcome</p>
                      <p className="mb-3 text-xs text-muted-foreground">
                        Sign in for the best experience
                      </p>
                      <div className="flex flex-col gap-2">
                        <Button asChild className="w-full">
                          <Link href={`${storeUrl}/auth/login`}>Sign in</Link>
                        </Button>
                        <Button variant="outline" asChild className="w-full">
                          <Link href={`${storeUrl}/auth/signup`}>
                            Create account
                          </Link>
                        </Button>
                      </div>
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Bottom Row: Search Bar - Always visible */}
          <form onSubmit={handleSearch} className="relative">
            <Search
              className={cn(
                "absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors pointer-events-none",
                isSearching && "animate-pulse"
              )}
            />
            <Input
              type="search"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 pl-10 pr-4 focus-visible:bg-background"
              aria-label="Search products"
            />
          </form>
        </div>
      </div>
    </header>
  );
}
