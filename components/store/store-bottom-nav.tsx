"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, ShoppingCart, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { cartActions } from "@/lib/stores/use-cart-store";
import { CartBadge } from "@/components/store/cart-badge";
import { useStoreBasePath } from "@/components/store/store-path-provider";

interface StoreBottomNavProps {
  cartItemCount?: number;
  isLoggedIn?: boolean;
  /** Hide the cart tab in catalog/showcase mode */
  isCartDisabled?: boolean;
}

/**
 * Persistent bottom tab bar for the storefront (mobile only).
 *
 * Hidden on product detail and checkout pages — those surfaces get their
 * own context-aware bottom bars (buy bar / checkout CTA), so only one
 * fixed element ever occupies the bottom of the screen at a time.
 */
export function StoreBottomNav({
  cartItemCount = 0,
  isLoggedIn = false,
  isCartDisabled = false,
}: StoreBottomNavProps) {
  const pathname = usePathname();
  const basePath = useStoreBasePath();
  const home = basePath || "/";

  // Product detail, cart, and checkout pages own the bottom zone themselves
  // (buy bar / sticky checkout CTA), so the tab bar steps aside there.
  if (
    pathname?.includes("/product/") ||
    pathname?.includes("/checkout") ||
    pathname?.includes("/cart")
  ) {
    return null;
  }

  const isHome = pathname === home || pathname === `${home}/`;
  // Exact match — `/categor` also matched `/category/[slug]`, lighting up the
  // Categories tab while the shopper was inside a single category.
  const isCategories = pathname?.startsWith(`${basePath}/categories`) ?? false;
  const isCart = pathname?.startsWith(`${basePath}/cart`) ?? false;
  const isAccount = pathname?.startsWith(`${basePath}/account`) ?? false;

  const accountHref = isLoggedIn
    ? `${basePath}/account`
    : `${basePath}/auth/login`;

  const itemClass = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors active:scale-95",
      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
    );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur-lg md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary navigation"
    >
      <div className="mx-auto flex max-w-md items-stretch">
        <Link
          href={home}
          className={itemClass(isHome)}
          aria-current={isHome ? "page" : undefined}
        >
          <Home className="size-5" />
          <span>Home</span>
        </Link>

        <Link
          href={`${basePath}/categories`}
          className={itemClass(isCategories)}
          aria-current={isCategories ? "page" : undefined}
        >
          <LayoutGrid className="size-5" />
          <span>Categories</span>
        </Link>

        {!isCartDisabled && (
          <button
            type="button"
            onClick={() => cartActions.setIsOpen(true)}
            className={itemClass(isCart)}
            aria-label="Open cart"
          >
            <span className="relative">
              <ShoppingCart className="size-5" />
              <CartBadge initialCount={cartItemCount} />
            </span>
            <span>Cart</span>
          </button>
        )}

        <Link
          href={accountHref}
          className={itemClass(isAccount)}
          aria-current={isAccount ? "page" : undefined}
        >
          <User className="size-5" />
          <span>Account</span>
        </Link>
      </div>
    </nav>
  );
}
