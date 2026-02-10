"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useTransition, useEffect } from "react";
import { Search, X, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface MarketplaceNavbarProps {
  user?: { id: string; email: string } | null;
}

export function MarketplaceNavbar({ user }: MarketplaceNavbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  // Sync with URL changes (back/forward navigation)
  useEffect(() => {
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      setQuery(params.get("q") || "");
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = query.trim();
      const params = new URLSearchParams(searchParams);

      if (trimmed) {
        params.set("q", trimmed);
      } else {
        params.delete("q");
      }
      params.delete("page");

      startTransition(() => {
        router.push(`/marketplace?${params.toString()}`);
      });
    },
    [query, searchParams, router]
  );

  function handleClear() {
    setQuery("");
    const params = new URLSearchParams(searchParams);
    params.delete("q");
    params.delete("page");

    startTransition(() => {
      router.push(`/marketplace?${params.toString()}`);
    });
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Desktop & Tablet Header */}
        <div className="hidden h-16 items-center gap-3 md:flex lg:gap-6">
          {/* Left: Logo + Marketplace */}
          <Link
            href="/marketplace"
            className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80"
          >
            <Image
              src="/icons/favicon-32x32.png"
              alt="Kaka Malem"
              width={32}
              height={32}
              className="size-8 rounded-lg"
            />
            <span className="text-base font-semibold tracking-tight">
              Marketplace
            </span>
          </Link>

          {/* Center: Search Bar */}
          <form onSubmit={handleSearch} className="flex flex-1 justify-center">
            <div className="relative w-full max-w-md lg:max-w-lg">
              <Search
                className={cn(
                  "absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors pointer-events-none",
                  isPending && "animate-pulse"
                )}
              />
              <Input
                type="search"
                placeholder="Search stores..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 pl-10 pr-10 focus-visible:bg-background"
                aria-label="Search stores"
              />
              {query && !isPending && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-2.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </form>

          {/* Right: Actions */}
          <div className="flex shrink-0 items-center gap-3">
            {user ? (
              <>
                <Button size="sm" asChild>
                  <Link href="/dashboard">My Store</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/logout">
                    <LogOut className="mr-1 size-3.5" />
                    Logout
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg px-4"
                  asChild
                >
                  <Link href="/login">Log in</Link>
                </Button>
                <Button
                  size="sm"
                  className="rounded-lg px-4 hover:ring-4 hover:ring-ring/20"
                  asChild
                >
                  <Link href="/signup">Sign up</Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Header */}
        <div className="flex flex-col gap-3 py-3 md:hidden">
          {/* Top Row: Logo + Actions */}
          <div className="flex items-center justify-between">
            {/* Left: Logo + Marketplace */}
            <Link
              href="/marketplace"
              className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80"
            >
              <Image
                src="/icons/favicon-32x32.png"
                alt="Kaka Malem"
                width={28}
                height={28}
                className="size-7 rounded-lg"
              />
              <span className="text-base font-semibold tracking-tight">
                Marketplace
              </span>
            </Link>

            {/* Right: Actions */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-full"
                    aria-label="Account menu"
                  >
                    <div className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <span className="text-xs font-medium">
                        {user.email[0].toUpperCase()}
                      </span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">
                      <User className="mr-2 size-4" />
                      My Store
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link
                      href="/logout"
                      className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 size-4" />
                      Logout
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg px-3 text-[0.8125rem]"
                  asChild
                >
                  <Link href="/login">Log in</Link>
                </Button>
                <Button
                  size="sm"
                  className="rounded-lg px-3 text-[0.8125rem] hover:ring-4 hover:ring-ring/20"
                  asChild
                >
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Bottom Row: Search Bar - Always visible */}
          <form onSubmit={handleSearch} className="relative">
            <Search
              className={cn(
                "absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors pointer-events-none",
                isPending && "animate-pulse"
              )}
            />
            <Input
              type="search"
              placeholder="Search stores..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 pl-10 pr-10 focus-visible:bg-background"
              aria-label="Search stores"
            />
            {query && !isPending && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </form>
        </div>
      </div>
    </header>
  );
}
