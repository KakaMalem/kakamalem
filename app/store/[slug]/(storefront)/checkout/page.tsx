import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { validateCartForCheckout } from "@/lib/db/queries/carts";
import { getShippingZones } from "@/lib/db/queries/shipping";
import { getUserAddresses } from "@/lib/db/queries/addresses";
import { getActiveDeliveryZones } from "@/lib/actions/delivery-zones";
import { getCartSessionIdOrNull } from "@/lib/cart/session";
import { getUser } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";
import { CheckoutContainer } from "@/components/store/checkout/checkout-container";

interface CheckoutPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: CheckoutPageProps): Promise<Metadata> {
  const { slug } = await params;
  const store = await getTenantBySlug(slug);

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
  const store = await getTenantBySlug(slug);
  if (!store || store.status !== "active") {
    notFound();
  }

  // Get session and user
  const [sessionId, user] = await Promise.all([
    getCartSessionIdOrNull(),
    getUser(),
  ]);

  // Check if cart exists and has items
  if (!sessionId) {
    redirect(`/store/${slug}/cart`);
  }

  const cartValidation = await validateCartForCheckout(
    store.id,
    sessionId,
    user?.id
  );

  // Redirect to cart if empty
  if (!cartValidation.cart || cartValidation.cart.items.length === 0) {
    redirect(`/store/${slug}/cart`);
  }

  // Check for cart validation errors
  if (!cartValidation.valid) {
    // Redirect to cart with error indication
    redirect(`/store/${slug}/cart?errors=true`);
  }

  // Check if store has shipping zones configured
  const shippingZones = await getShippingZones(store.id);

  if (shippingZones.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <ShoppingCart className="mx-auto size-16 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold">Checkout Unavailable</h1>
        <p className="mt-2 text-muted-foreground">
          This store is still setting up shipping options. Please contact the
          store or try again later.
        </p>
        <Button asChild className="mt-6">
          <Link href={`/store/${slug}/cart`}>Back to Cart</Link>
        </Button>
      </div>
    );
  }

  // Get user's saved addresses if logged in
  const savedAddresses = user ? await getUserAddresses(user.id) : [];

  // Get active delivery zones if the store has delivery zones enabled
  const deliveryZones = store.enableDeliveryZones
    ? await getActiveDeliveryZones(store.id)
    : [];

  // Calculate cart subtotal with tier pricing
  const subtotal = cartValidation.cart.items.reduce((sum, item) => {
    const basePrice = item.variant?.price
      ? parseFloat(item.variant.price)
      : parseFloat(item.product.price);

    // Find applicable tier for this quantity
    let effectivePrice = basePrice;
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

  return (
    <CheckoutContainer
      tenantId={store.id}
      storeSlug={slug}
      currency={store.currency}
      cart={cartValidation.cart}
      savedAddresses={savedAddresses}
      user={user}
      subtotal={subtotal}
      deliveryZones={deliveryZones}
    />
  );
}
