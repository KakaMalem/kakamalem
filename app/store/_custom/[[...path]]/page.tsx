import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { Package, Store } from "lucide-react";
import type { Metadata } from "next";

import { getTenantByCustomDomain } from "@/lib/db/queries/tenants";
import { getProducts } from "@/lib/db/queries/products";
import { getCategoriesWithCounts } from "@/lib/db/queries/categories";
import { getOrCreateCart } from "@/lib/db/queries/carts";
import { getWishlistedProductIds } from "@/lib/db/queries/wishlists";
import { getCartSessionIdOrNull } from "@/lib/cart/session";
import { getUser } from "@/lib/auth/server";
import { getUserStoreContext } from "@/lib/auth/context";
import { InfiniteScrollProducts } from "@/components/store/infinite-scroll-products";
import { StoreHeaderWrapper } from "@/components/store/store-header-wrapper";
import { StoreCategoriesBar } from "@/components/store/store-categories-bar";
import { StoreFooter } from "@/components/store/store-footer";
import { CartProvider } from "@/components/store/cart-provider";
import { CartDrawer } from "@/components/store/cart-drawer";
import { WishlistHydration } from "@/components/store/wishlist-hydration";
import { WhatsAppButton } from "@/components/store/whatsapp-button";
import {
  StoreStructuredData,
  WebsiteStructuredData,
} from "@/components/store/store-structured-data";
import { Button } from "@/components/ui/button";
import { QueryProvider } from "@/lib/providers/query-provider";
import type { SocialLinks } from "@/lib/db/schema";

interface CustomDomainPageProps {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<{ q?: string }>;
}

/**
 * Get the custom domain from request headers
 */
async function getCustomDomainFromHeaders(): Promise<string | null> {
  const headersList = await headers();
  return headersList.get("x-custom-domain");
}

/**
 * Custom Domain Route Handler
 *
 * This page handles requests from custom domains that are rewritten by middleware.
 * It renders the store content directly, preserving the custom domain in the browser URL.
 */
export default async function CustomDomainPage({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  params,
  searchParams,
}: CustomDomainPageProps) {
  // path available via (await params).path for future sub-routing
  const { q: searchQuery } = await searchParams;

  // Get the custom domain from the header set by middleware
  const customDomain = await getCustomDomainFromHeaders();

  if (!customDomain) {
    console.error("[CustomDomain] No x-custom-domain header found");
    notFound();
  }

  // Look up the tenant by custom domain
  const store = await getTenantByCustomDomain(customDomain);

  if (!store) {
    console.warn(
      `[CustomDomain] No active tenant found for domain: ${customDomain}`
    );
    notFound();
  }

  const slug = store.slug;

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
        </div>
      </div>
    );
  }

  // Check if store is POS-only (no online storefront)
  if (store.storeMode === "offline_only") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-muted">
            <Store className="size-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{store.name}</h1>
          <p className="mt-3 text-muted-foreground">
            This store operates in-person only and does not have an online
            storefront.
          </p>
        </div>
      </div>
    );
  }

  // Fetch all needed data
  const [categories, user, sessionId, productsResult] = await Promise.all([
    getCategoriesWithCounts(store.id),
    getUser(),
    getCartSessionIdOrNull(),
    getProducts(store.id, {
      page: 1,
      limit: 20,
      filters: { isActive: true, showOnStorefront: true, search: searchQuery },
      sort: { field: "displayOrder", direction: "asc" },
    }),
  ]);

  // Fetch wishlisted product IDs
  const wishlistedProductIds = user
    ? await getWishlistedProductIds(store.id, user.id)
    : [];

  // Get user's relationship to this store
  const userContext = user ? await getUserStoreContext(store.id) : null;

  // Get cart data
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

  const isCartDisabled = store.storeMode === "catalog";
  const hasProducts = productsResult.products.length > 0;

  // WhatsApp button settings
  const socialLinks = store.socialLinks as SocialLinks | null;
  const showWhatsAppButton = socialLinks?.showWhatsAppButton ?? true;
  const whatsappNumber = socialLinks?.whatsapp || "";

  // TODO: Add routing for /products, /product/[slug], /category/[slug], /cart, /checkout, etc.

  return (
    <QueryProvider>
      <CartProvider initialCart={cart} storeSlug={slug}>
        <StoreStructuredData
          store={{
            name: store.name,
            slug: slug,
            tagline: store.tagline,
            description: store.description,
            logoUrl: store.logoUrl,
            contactEmail: store.contactEmail,
            contactPhone: store.contactPhone,
            socialLinks: socialLinks,
            currency: store.currency,
          }}
        />
        <WebsiteStructuredData storeName={store.name} storeSlug={slug} />

        <WishlistHydration
          tenantId={store.id}
          initialProductIds={wishlistedProductIds}
        />

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

          <main className="flex-1">
            <div className="flex flex-col min-h-[50vh]">
              {/* Search Results Info */}
              {searchQuery && (
                <div className="border-b bg-muted/20 py-3 sm:py-4">
                  <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {productsResult.pagination.total}
                        </span>{" "}
                        result{productsResult.pagination.total !== 1 && "s"} for{" "}
                        <span className="font-medium text-foreground">
                          &quot;{searchQuery}&quot;
                        </span>
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        asChild
                      >
                        <Link href="/">Clear</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Products Grid */}
              <section className="py-6 sm:py-8 flex-1">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                  {hasProducts ? (
                    <InfiniteScrollProducts
                      initialProducts={productsResult.products}
                      initialPagination={productsResult.pagination}
                      tenantId={store.id}
                      storeSlug={slug}
                      currency={store.currency}
                      filters={{
                        isActive: true,
                        showOnStorefront: true,
                        search: searchQuery,
                      }}
                      sort={{ field: "displayOrder", direction: "asc" }}
                      catalogMode={isCartDisabled}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center">
                      <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-muted/50">
                        <Package className="size-10 text-muted-foreground/50" />
                      </div>
                      <h2 className="text-xl font-semibold">
                        {searchQuery ? "No products found" : "No products yet"}
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                        {searchQuery
                          ? "Try adjusting your search terms or browse our categories"
                          : "Check back soon for new arrivals!"}
                      </p>
                      {searchQuery && (
                        <Button variant="outline" className="mt-6" asChild>
                          <Link href="/">Clear search</Link>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </main>

          <StoreFooter
            store={store}
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
            }))}
            hideBranding={store.subscriptionPlan === "pro"}
          />

          {!isCartDisabled && (
            <CartDrawer storeSlug={slug} currency={store.currency} />
          )}

          {showWhatsAppButton && whatsappNumber && (
            <WhatsAppButton phoneNumber={whatsappNumber} />
          )}
        </div>
      </CartProvider>
    </QueryProvider>
  );
}

/**
 * Generate metadata for custom domain pages
 */
export async function generateMetadata(): Promise<Metadata> {
  const customDomain = await getCustomDomainFromHeaders();

  if (!customDomain) {
    return { title: "Store Not Found" };
  }

  const store = await getTenantByCustomDomain(customDomain);

  if (!store) {
    return { title: "Store Not Found" };
  }

  const seo = store.seo as {
    metaTitle?: string;
    metaDescription?: string;
    ogImageUrl?: string;
  } | null;

  const baseUrl = `https://${customDomain}`;
  const makeAbsolute = (url: string | null | undefined) => {
    if (!url) return undefined;
    if (url.startsWith("http")) return url;
    return `${process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com"}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const ogImageUrl =
    makeAbsolute(seo?.ogImageUrl) || makeAbsolute(store.logoUrl);
  const title = seo?.metaTitle || store.name;
  const description =
    seo?.metaDescription ||
    store.tagline ||
    store.description ||
    `Shop at ${store.name}`;

  return {
    title,
    description,
    alternates: {
      canonical: baseUrl,
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: baseUrl,
      siteName: store.name,
      locale: "en_US",
      images: ogImageUrl
        ? [{ url: ogImageUrl, width: 1200, height: 630, alt: store.name }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImageUrl ? [ogImageUrl] : undefined,
    },
    icons: store.faviconUrl ? { icon: store.faviconUrl } : undefined,
  };
}
