import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { resolveTenant } from "@/lib/db/queries/tenants";
import { getStoreBasePath } from "@/lib/utils/store-path";
import { validateCartForCheckout } from "@/lib/db/queries/carts";
import { getUserAddresses } from "@/lib/db/queries/addresses";
import { getPrimaryStoreLocation } from "@/lib/db/queries/store-locations";
import { hasActiveCoupons } from "@/lib/db/queries/coupons";
import { getProductsCampaignDiscounts } from "@/lib/db/queries/campaigns";
import { applyCampaignDiscount } from "@/lib/utils/pricing-display";
import { db } from "@/lib/db";
import { products as productsTable } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { getActiveDeliveryZones } from "@/lib/actions/delivery-zones";
import {
  isUnifiedDeliveryEnabled,
  getUnifiedZonesForCheckout,
  type CheckoutDeliveryZone,
} from "@/lib/actions/unified-delivery";
import {
  getStorePaymentGateways,
  getLatestPendingPaymentSession,
} from "@/lib/actions/payments";
import { getCartSessionIdOrNull } from "@/lib/cart/session";
import { getUser, getUserProfile } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";
import { CheckoutContainer } from "@/components/store/checkout/checkout-container";

interface CheckoutPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: CheckoutPageProps): Promise<Metadata> {
  const { slug } = await params;
  const store = await resolveTenant(slug);

  if (!store) {
    return { title: "Checkout - Store Not Found" };
  }

  return {
    title: `Checkout - ${store.name}`,
    description: `Complete your purchase at ${store.name}`,
  };
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { slug } = await params;

  // Fetch store
  const store = await resolveTenant(slug);
  if (!store || store.status !== "active") {
    notFound();
  }

  const basePath = await getStoreBasePath(store.slug);

  // Check if online checkout is enabled
  if (!store.onlineCheckoutEnabled) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <ShoppingCart className="mx-auto size-16 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold">Online Checkout Unavailable</h1>
        <p className="mt-2 text-muted-foreground">
          This store does not accept online orders. Please contact the store
          directly to make a purchase.
        </p>
        {store.contactPhone && (
          <p className="mt-4">
            <a
              href={`tel:${store.contactPhone}`}
              className="text-primary hover:underline"
            >
              Call: {store.contactPhone}
            </a>
          </p>
        )}
        <Button asChild className="mt-6">
          <Link href={`${basePath}`}>Back to Store</Link>
        </Button>
      </div>
    );
  }

  // Get session and user
  const [sessionId, user] = await Promise.all([
    getCartSessionIdOrNull(),
    getUser(),
  ]);

  // Check if cart exists and has items
  if (!sessionId) {
    redirect(`${basePath}/cart?error=session`);
  }

  const cartValidation = await validateCartForCheckout(
    store.id,
    sessionId,
    user?.id
  );

  // Redirect to cart if empty, but first check for pending payment sessions
  // This handles the case where user created an order but didn't complete payment
  if (!cartValidation.cart || cartValidation.cart.items.length === 0) {
    // Check if there's a pending payment session (user might be returning from payment gateway)
    const pendingPayment = await getLatestPendingPaymentSession(
      store.id,
      user?.id
    );

    if (pendingPayment?.orderId) {
      // Redirect to payment retry page instead of showing cart empty error
      redirect(`${basePath}/checkout/payment?order=${pendingPayment.orderId}`);
    }

    redirect(`${basePath}/cart?error=empty`);
  }

  // Check for cart validation errors
  if (!cartValidation.valid) {
    // Encode errors for the cart page to display
    const errorsParam = encodeURIComponent(
      JSON.stringify(cartValidation.errors)
    );
    redirect(`${basePath}/cart?error=validation&errors=${errorsParam}`);
  }

  // Fetch delivery zones for checkout visualization
  // Priority: 1. Unified zones (new system), 2. Legacy zones, 3. No restrictions (allow anywhere)
  let deliveryZones: CheckoutDeliveryZone[] = [];
  const unifiedEnabled = await isUnifiedDeliveryEnabled(store.id);

  if (unifiedEnabled) {
    // Use unified delivery system zones
    deliveryZones = await getUnifiedZonesForCheckout(store.id);
  } else if (store.enableDeliveryZones) {
    // Fall back to legacy delivery zones (convert to unified format)
    const legacyZones = await getActiveDeliveryZones(store.id);
    deliveryZones = legacyZones.map((z) => ({
      id: z.id,
      name: z.name,
      zoneType: "radius" as const,
      color: z.color,
      centerLat: z.centerLat,
      centerLng: z.centerLng,
      radiusMeters: z.radiusMeters,
      polygonGeojson: null,
      deliveryFee: z.deliveryFee,
      freeShippingThreshold: z.freeShippingThreshold,
      estimatedDeliveryTime: z.estimatedDeliveryTime,
      isActive: z.isActive,
    }));
  }
  // If neither unified nor legacy zones exist, deliveryZones stays empty
  // This allows delivery to anywhere (no zone restrictions)

  // Get user's saved addresses, profile, enabled payment methods, primary store location, and coupon availability
  const [
    savedAddresses,
    userProfile,
    enabledPaymentMethods,
    primaryLocation,
    showPromoCode,
  ] = await Promise.all([
    user ? getUserAddresses(user.id) : Promise.resolve([]),
    user ? getUserProfile() : Promise.resolve(null),
    getStorePaymentGateways(store.id),
    getPrimaryStoreLocation(store.id),
    hasActiveCoupons(store.id),
  ]);

  // Fetch product categoryIds for campaign matching (cart doesn't include them)
  const productIds = cartValidation.cart.items.map((item) => item.productId);
  const productCategoryRows =
    productIds.length > 0
      ? await db.query.products.findMany({
          where: inArray(productsTable.id, productIds),
          columns: { id: true, categoryId: true },
        })
      : [];
  const categoryMap = new Map(
    productCategoryRows.map((p) => [p.id, p.categoryId])
  );

  // Fetch campaign discounts for cart products
  const campaignDiscounts = await getProductsCampaignDiscounts(
    store.id,
    cartValidation.cart.items.map((item) => ({
      productId: item.productId,
      categoryId: categoryMap.get(item.productId) ?? null,
    }))
  );

  // Calculate cart subtotal with tier pricing AND campaign discounts
  const subtotal = cartValidation.cart.items.reduce((sum, item) => {
    const basePrice = item.variant?.price
      ? parseFloat(item.variant.price)
      : parseFloat(item.product.price);

    // Apply campaign discount first
    const campaign = campaignDiscounts.get(item.productId);
    const afterCampaignPrice = campaign
      ? applyCampaignDiscount(basePrice, campaign)
      : basePrice;

    // Then find applicable tier for this quantity
    let effectivePrice = afterCampaignPrice;
    if (item.product.priceTiers && item.product.priceTiers.length > 0) {
      const sortedTiers = [...item.product.priceTiers].sort(
        (a, b) => b.minQuantity - a.minQuantity
      );
      for (const tier of sortedTiers) {
        if (item.quantity >= tier.minQuantity) {
          if (tier.maxQuantity === null || item.quantity <= tier.maxQuantity) {
            effectivePrice = parseFloat(tier.price);
            break;
          }
        }
      }
    }

    return sum + effectivePrice * item.quantity;
  }, 0);

  // Extract store location if available (prefer new locations system, fall back to legacy)
  const storeLocation = primaryLocation
    ? {
        lat: parseFloat(primaryLocation.latitude),
        lng: parseFloat(primaryLocation.longitude),
      }
    : store.storeLocationLat && store.storeLocationLng
      ? {
          lat: parseFloat(store.storeLocationLat),
          lng: parseFloat(store.storeLocationLng),
        }
      : null;

  return (
    <CheckoutContainer
      tenantId={store.id}
      storeSlug={store.slug}
      storeName={store.name}
      currency={store.currency}
      cart={cartValidation.cart}
      savedAddresses={savedAddresses}
      user={user}
      userPhone={userProfile?.phone || ""}
      subtotal={subtotal}
      deliveryZones={deliveryZones}
      enabledPaymentMethods={enabledPaymentMethods}
      storeLocation={storeLocation}
      showPromoCode={showPromoCode}
    />
  );
}
