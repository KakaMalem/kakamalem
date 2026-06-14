import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Store } from "lucide-react";

import { resolveTenant } from "@/lib/db/queries/tenants";
import { getStoreBasePath, getStoreBaseUrl } from "@/lib/utils/store-path";
import { StorePathProvider } from "@/components/store/store-path-provider";
import { getCategoriesWithCounts } from "@/lib/db/queries/categories";
import { getOrCreateCart } from "@/lib/db/queries/carts";
import { getWishlistedProductIds } from "@/lib/db/queries/wishlists";
import { getActiveCampaigns } from "@/lib/db/queries/campaigns";
import { getCartSessionIdOrNull } from "@/lib/cart/session";
import { getUser } from "@/lib/auth/server";
import { getUserStoreContext } from "@/lib/auth/context";
import { StoreHeaderWrapper } from "@/components/store/store-header-wrapper";
import { StoreCategoriesBar } from "@/components/store/store-categories-bar";
import { StoreBottomNav } from "@/components/store/store-bottom-nav";
import { StoreFooter } from "@/components/store/store-footer";
import { CartProvider } from "@/components/store/cart-provider";
import { CurrencyProvider } from "@/lib/stores/use-currency-store";
import { CartDrawer } from "@/components/store/cart-drawer";
import { WishlistHydration } from "@/components/store/wishlist-hydration";
import { WhatsAppButton } from "@/components/store/whatsapp-button";
import { SaleBanner } from "@/components/store/sale-banner";
import {
  StoreStructuredData,
  WebsiteStructuredData,
} from "@/components/store/store-structured-data";
import type { SocialLinks } from "@/lib/db/schema";
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
  const store = await resolveTenant(slug);

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

  // Helper to make URLs absolute for OG tags (WhatsApp, Facebook, etc. need full URLs)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com";
  const makeAbsolute = (url: string | null | undefined) => {
    if (!url) return undefined;
    if (url.startsWith("http")) return url;
    return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const ogImageUrl =
    makeAbsolute(seo?.ogImageUrl) || makeAbsolute(store.logoUrl);

  const title = seo?.metaTitle || store.name;
  const description =
    seo?.metaDescription ||
    store.tagline ||
    store.description ||
    `Shop at ${store.name}`;
  const storeBaseUrl = await getStoreBaseUrl(store.slug);

  return {
    title,
    description,
    // Canonical URL prevents duplicate content issues
    alternates: {
      canonical: storeBaseUrl,
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: storeBaseUrl,
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
    // Additional SEO metadata
    keywords: store.tagline ? store.tagline.split(" ") : undefined,
    authors: [{ name: store.name }],
    creator: store.name,
    publisher: store.name,
  };
}

export default async function StoreLayout({
  children,
  params,
}: StoreLayoutProps) {
  const { slug } = await params;

  // Fetch store data (supports custom domain resolution)
  const store = await resolveTenant(slug);

  // Handle store not found
  if (!store) {
    notFound();
  }

  // Get the base path for this store (custom domain = "/" or path-based = "/store/slug")
  const basePath = await getStoreBasePath(store.slug);

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
          <Button asChild className="mt-6">
            <Link href="/">Browse Other Stores</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Fetch categories, user, session data, and active campaigns
  const [categories, user, sessionId, activeCampaigns] = await Promise.all([
    getCategoriesWithCounts(store.id),
    getUser(),
    getCartSessionIdOrNull(),
    getActiveCampaigns(store.id),
  ]);

  // Fetch wishlisted product IDs (for hydrating the wishlist store)
  const wishlistedProductIds = user
    ? await getWishlistedProductIds(store.id, user.id)
    : [];

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

  // Check if online cart should be disabled (catalog mode = display only)
  // Note: offline_only stores already returned early above
  const isCartDisabled = store.storeMode === "catalog";

  // WhatsApp button settings
  const socialLinks = store.socialLinks as SocialLinks | null;
  const showWhatsAppButton = socialLinks?.showWhatsAppButton ?? true;
  const whatsappNumber = socialLinks?.whatsapp || "";

  return (
    <QueryProvider>
      <StorePathProvider basePath={basePath}>
        <CurrencyProvider currency={store.currency}>
          <CartProvider initialCart={cart} storeSlug={store.slug}>
            {/* SEO: Organization/Store structured data for Google Knowledge Panel */}
            <StoreStructuredData
              store={{
                name: store.name,
                slug: store.slug,
                tagline: store.tagline,
                description: store.description,
                logoUrl: store.logoUrl,
                contactEmail: store.contactEmail,
                contactPhone: store.contactPhone,
                socialLinks: socialLinks,
                currency: store.currency,
              }}
            />
            {/* SEO: Website structured data for sitelinks searchbox */}
            <WebsiteStructuredData
              storeName={store.name}
              storeSlug={store.slug}
            />

            <WishlistHydration
              tenantId={store.id}
              initialProductIds={wishlistedProductIds}
            />
            <div className="flex min-h-screen flex-col bg-background pb-16 md:pb-0">
              {/* Sale Banner - positioned at very top, only shown on homepage */}
              {activeCampaigns.length > 0 && (
                <SaleBanner
                  campaign={activeCampaigns[0]}
                  storeSlug={store.slug}
                  currency={store.currency}
                />
              )}
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
              {/* Categories bar - hidden on checkout to keep focus */}
              <StoreCategoriesBar
                categories={categories.map((c) => ({
                  id: c.id,
                  name: c.name,
                  slug: c.slug,
                  imageUrl: c.imageUrl,
                }))}
                storeSlug={store.slug}
              />
              <main className="flex-1">{children}</main>
              <StoreFooter
                store={store}
                categories={categories.map((c) => ({
                  id: c.id,
                  name: c.name,
                  slug: c.slug,
                }))}
                hideBranding={store.subscriptionPlan === "pro"}
              />
              {/* Cart Drawer - Hidden when online cart is disabled */}
              {!isCartDisabled && (
                <CartDrawer
                  storeSlug={store.slug}
                  currency={store.currency}
                  tenantId={store.id}
                />
              )}
              {/* Mobile bottom tab bar */}
              <StoreBottomNav
                cartItemCount={cartItemCount}
                isLoggedIn={!!user}
                isCartDisabled={isCartDisabled}
              />
              {/* Floating WhatsApp Button */}
              {showWhatsAppButton && whatsappNumber && (
                <WhatsAppButton phoneNumber={whatsappNumber} />
              )}
            </div>
          </CartProvider>
        </CurrencyProvider>
      </StorePathProvider>
    </QueryProvider>
  );
}
