import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getOrCreateCart } from "@/lib/db/queries/carts";
import { getCartSessionIdOrNull } from "@/lib/cart/session";
import { getUser } from "@/lib/supabase/auth";
import { CartProvider } from "@/components/store/cart-provider";
import { CartContent } from "@/components/store/cart-content";

interface CartPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: CartPageProps): Promise<Metadata> {
  const { slug } = await params;
  const store = await getTenantBySlug(slug);

  if (!store) {
    return { title: "Cart - Store Not Found" };
  }

  return {
    title: `Shopping Cart - ${store.name}`,
    description: `View your shopping cart at ${store.name}`,
  };
}

export default async function CartPage({ params }: CartPageProps) {
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

  // Get cart with items (only if session exists, otherwise empty cart)
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

  return (
    <CartProvider initialCart={cart} tenantId={store.id} storeSlug={slug}>
      <CartContent
        tenantId={store.id}
        storeSlug={slug}
        currency={store.currency}
      />
    </CartProvider>
  );
}
