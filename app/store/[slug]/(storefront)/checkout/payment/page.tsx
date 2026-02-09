import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getOrderById } from "@/lib/db/queries/orders";
import { getUser } from "@/lib/auth/server";
import { getEnabledGateways } from "@/lib/payments";
import { PaymentPageClient } from "@/components/store/checkout/payment-page-client";

interface PaymentPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    order?: string;
    cancelled?: string;
  }>;
}

export async function generateMetadata({
  params,
}: PaymentPageProps): Promise<Metadata> {
  const { slug } = await params;
  const store = await getTenantBySlug(slug);

  if (!store) {
    return { title: "Payment - Store Not Found" };
  }

  return {
    title: `Complete Payment - ${store.name}`,
    description: `Complete your payment at ${store.name}`,
  };
}

export default async function PaymentPage({
  params,
  searchParams,
}: PaymentPageProps) {
  const { slug } = await params;
  const { order: orderId, cancelled } = await searchParams;

  // Fetch store
  const store = await getTenantBySlug(slug);
  if (!store || store.status !== "active") {
    notFound();
  }

  // Redirect if no order ID
  if (!orderId) {
    redirect(`/store/${slug}`);
  }

  // Get user
  const user = await getUser();

  // Fetch order
  let order = null;
  if (user) {
    order = await getOrderById(orderId, user.id, store.id);
  }

  // If order not found or already paid, redirect appropriately
  if (!order) {
    redirect(`/store/${slug}`);
  }

  if (order.paymentStatus === "paid") {
    redirect(`/store/${slug}/checkout/success?order=${orderId}`);
  }

  // Fetch enabled payment methods for this store
  const enabledGateways = await getEnabledGateways(store.id);

  // Filter to only online payment gateways (exclude COD, bank_transfer for retry page)
  const onlineGateways = enabledGateways.filter(
    (g) =>
      g.gateway === "hesabpay" ||
      g.gateway === "stripe" ||
      g.gateway === "crypto_usdt"
  );

  const wasCancelled = cancelled === "true";

  return (
    <PaymentPageClient
      storeSlug={slug}
      orderId={orderId}
      orderNumber={order.orderNumber}
      itemCount={order.items.length}
      amount={parseFloat(order.amountDue || order.total)}
      currency={store.currency}
      wasCancelled={wasCancelled}
      enabledGateways={onlineGateways}
    />
  );
}
