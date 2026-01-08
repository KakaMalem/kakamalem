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
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";
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
import { signOut } from "@/lib/auth/actions";

import type { Tenant } from "@/lib/db/schema";

interface StoreHeaderProps {
  store: Tenant;
  cartItemCount?: number;
  user?: { name?: string; email?: string; avatarUrl?: string } | null;
}

export function StoreHeader({
  store,
  cartItemCount = 0,
  user,
}: StoreHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [isSearching, startSearchTransition] = useTransition();

  // Get hydrated cart count that syncs with Zustand store
  const hydratedCartCount = useHydratedCartCount(cartItemCount);

  const storeUrl = `/store/${store.slug}`;

  // Determine what to show in the header based on headerDisplay setting
  const showLogo =
    store.headerDisplay === "logo_only" ||
    store.headerDisplay === "logo_and_name";
  const showName =
    store.headerDisplay === "name_only" ||
    store.headerDisplay === "logo_and_name";

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

  const handleSignOut = async () => {
    await signOut();
    router.refresh();
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
      <div className="container mx-auto px-4">
        {/* Desktop Header */}
        <div className="hidden h-16 items-center gap-6 md:flex">
          {/* Left: Logo / Store Name */}
          <Link
            href={storeUrl}
            className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80"
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
              <span className="text-lg font-semibold tracking-tight">
                {store.name}
              </span>
            )}
          </Link>

          {/* Center: Search Bar */}
          <form onSubmit={handleSearch} className="flex flex-1 justify-center">
            <div className="relative w-full max-w-lg">
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
          <div className="flex shrink-0 items-center gap-2">
            {/* Cart Button */}
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
                    <p className="text-sm font-medium">{user.name || "User"}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">
                      <LayoutDashboard className="mr-2 size-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
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
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/signup">Register</Link>
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

            {/* Right: Cart & Profile */}
            <div className="flex items-center gap-0.5">
              {/* Cart Button */}
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
                        <p className="text-sm font-medium">
                          {user.name || "User"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard">
                          <LayoutDashboard className="mr-2 size-4" />
                          Dashboard
                        </Link>
                      </DropdownMenuItem>
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
                          <Link href="/login">Sign in</Link>
                        </Button>
                        <Button variant="outline" asChild className="w-full">
                          <Link href="/signup">Create account</Link>
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
