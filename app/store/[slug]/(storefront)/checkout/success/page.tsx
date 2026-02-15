import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { resolveTenant } from "@/lib/db/queries/tenants";
import { getStoreBasePath } from "@/lib/utils/store-path";
import { getOrderById, getOrderItemsWithImages } from "@/lib/db/queries/orders";
import { getUser } from "@/lib/auth/server";
import { OrderSuccessContent } from "@/components/store/checkout/order-success-content";
import { ClearCartSession } from "@/components/store/checkout/clear-cart-session";
import type { Address } from "@/lib/db/schema";

interface CheckoutSuccessPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    order?: string;
    payment?: "success" | "pending" | "cancelled";
  }>;
}

export async function generateMetadata({
  params,
}: CheckoutSuccessPageProps): Promise<Metadata> {
  const { slug } = await params;
  const store = await resolveTenant(slug);

  if (!store) {
    return { title: "Order Confirmation - Store Not Found" };
  }

  return {
    title: `Order Confirmed - ${store.name}`,
    description: `Thank you for your order at ${store.name}`,
  };
}

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: CheckoutSuccessPageProps) {
  const { slug } = await params;
  const { order: orderId, payment: paymentStatus } = await searchParams;

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

  // Get user (optional - guest orders have no user)
  const user = await getUser();

  // Fetch order
  // Note: getOrderById requires userId, but for guest orders we need a different approach
  // For now, we'll show a generic confirmation for guest orders
  let order = null;
  if (user) {
    order = await getOrderById(orderId, user.id, store.id);
  }

  // If user is logged in but order not found, they may be trying to view someone else's order
  if (user && !order) {
    redirect(`${basePath}`);
  }

  // Fetch order items with images (prioritizes variant images)
  const itemsWithImages = order ? await getOrderItemsWithImages(orderId) : [];
  const itemImageMap = new Map(
    itemsWithImages.map((item) => [item.id, item.productImage])
  );

  // Transform order data for client component
  const orderData = order
    ? {
        id: order.id,
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        items: order.items.map((item) => {
          const image = itemImageMap.get(item.id);
          return {
            id: item.id,
            productName: item.productName,
            variantName: item.variantName,
            quantity: item.quantity,
            image: image ? { url: image.url, alt: image.alt } : null,
          };
        }),
        total: order.total,
        shippingAddress: order.shippingAddress as Address | undefined,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
      }
    : null;

  return (
    <>
      {/* Clear cart session on mount (client-side) */}
      <ClearCartSession />
      <OrderSuccessContent
        storeSlug={store.slug}
        currency={store.currency}
        order={orderData}
        user={user ? { id: user.id } : null}
        paymentStatus={paymentStatus}
      />
    </>
  );
}
