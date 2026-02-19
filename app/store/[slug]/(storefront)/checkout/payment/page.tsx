import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { resolveTenant } from "@/lib/db/queries/tenants";
import { getStoreBasePath } from "@/lib/utils/store-path";
import { getOrderForCheckout } from "@/lib/db/queries/orders";
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
  const store = await resolveTenant(slug);

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
  const { order: rawOrderId, cancelled } = await searchParams;

  // HesabPay appends ?data={...} to the redirect URL, which corrupts the order param
  // Extract just the UUID from the order parameter
  const orderId = rawOrderId?.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  )?.[1];

  // Fetch store
  const store = await resolveTenant(slug);
  if (!store || store.status !== "active") {
    notFound();
  }

  const basePath = await getStoreBasePath(store.slug);

  // Redirect if no order ID
  if (!orderId) {
    redirect(`${basePath}`);
  }

  // Fetch order (works for both guests and logged-in users)
  const order = await getOrderForCheckout(orderId, store.id);

  if (!order) {
    redirect(`${basePath}`);
  }

  if (order.paymentStatus === "paid") {
    redirect(`${basePath}/checkout/success?order=${orderId}`);
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
      storeSlug={store.slug}
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
