import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Store } from "lucide-react";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getCategoriesWithCounts } from "@/lib/db/queries/categories";
import { getOrCreateCart } from "@/lib/db/queries/carts";
import { getCartSessionIdOrNull } from "@/lib/cart/session";
import { getUser } from "@/lib/auth/server";
import { getUserStoreContext } from "@/lib/auth/context";
import { StoreHeaderWrapper } from "@/components/store/store-header-wrapper";
import { StoreCategoriesBar } from "@/components/store/store-categories-bar";
import { StoreFooter } from "@/components/store/store-footer";
import { CartProvider } from "@/components/store/cart-provider";
import { CartDrawer } from "@/components/store/cart-drawer";
import { Button } from "@/components/ui/button";
import { QueryProvider } from "@/lib/providers/query-provider";

interface StoreLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const store = await getTenantBySlug(slug);

  if (!store) {
    return {
      title: "Store Not Found",
    };
  }

  const seo = store.seo as {
    metaTitle?: string;
    metaDescription?: string;
    ogImageUrl?: string;
  } | null;

  return {
    title: seo?.metaTitle || store.name,
    description:
      seo?.metaDescription ||
      store.tagline ||
      store.description ||
      `Shop at ${store.name}`,
    openGraph: {
      title: seo?.metaTitle || store.name,
      description:
        seo?.metaDescription ||
        store.tagline ||
        store.description ||
        `Shop at ${store.name}`,
      images: seo?.ogImageUrl
        ? [{ url: seo.ogImageUrl }]
        : store.logoUrl
          ? [{ url: store.logoUrl }]
          : undefined,
    },
    icons: store.faviconUrl ? { icon: store.faviconUrl } : undefined,
  };
}

export default async function StoreLayout({
  children,
  params,
}: StoreLayoutProps) {
  const { slug } = await params;

  // Fetch store data
  const store = await getTenantBySlug(slug);

  // Handle store not found
  if (!store) {
    notFound();
  }

  // Check if store is active
  if (store.status !== "active") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-muted">
            <Store className="size-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Store Unavailable
          </h1>
          <p className="mt-3 text-muted-foreground">
            This store is currently not available. Please check back later.
          </p>
          <Button asChild className="mt-6">
            <Link href="/">Browse Other Stores</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Fetch categories, user, and session data
  const [categories, user, sessionId] = await Promise.all([
    getCategoriesWithCounts(store.id),
    getUser(),
    getCartSessionIdOrNull(),
  ]);

  // Get user's relationship to this store (owner/staff/customer)
  const userContext = user ? await getUserStoreContext(store.id) : null;

  // Get cart data from database (only if session exists, otherwise empty cart)
  const cart = sessionId
    ? await getOrCreateCart(store.id, sessionId, user?.id)
    : {
        id: "",
        tenantId: store.id,
        sessionId: "",
        customerId: user?.id || null,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
  const cartItemCount = cart.items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  // Check if store is in catalog mode (no cart functionality)
  const isCatalogMode = store.storeMode === "catalog";

  return (
    <QueryProvider>
      <CartProvider initialCart={cart} storeSlug={slug}>
        <div className="flex min-h-screen flex-col bg-background">
          <StoreHeaderWrapper
            store={store}
            cartItemCount={cartItemCount}
            user={
              user
                ? {
                    name: user.name,
                    email: user.email,
                    avatarUrl: user.image || undefined,
                  }
                : null
            }
            userContext={
              userContext
                ? {
                    isOwner: userContext.isOwner,
                    isStaff: userContext.isStaff,
                    isMember: userContext.isMember,
                    role: userContext.role,
                  }
                : null
            }
          />
          <StoreCategoriesBar
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              imageUrl: c.imageUrl,
            }))}
            storeSlug={slug}
          />
          <main className="flex-1">{children}</main>
          <StoreFooter
            store={store}
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
            }))}
          />
          {/* Cart Drawer - Hidden in catalog mode */}
          {!isCatalogMode && (
            <CartDrawer storeSlug={slug} currency={store.currency} />
          )}
        </div>
      </CartProvider>
    </QueryProvider>
  );
}
