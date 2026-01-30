import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getOrderById, getOrderItemsWithImages } from "@/lib/db/queries/orders";
import { getUser } from "@/lib/auth/server";
import { OrderSuccessContent } from "@/components/store/checkout/order-success-content";
import type { Address } from "@/lib/db/schema";

interface CheckoutSuccessPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ order?: string }>;
}

export async function generateMetadata({
  params,
}: CheckoutSuccessPageProps): Promise<Metadata> {
  const { slug } = await params;
  const store = await getTenantBySlug(slug);

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
  const { order: orderId } = await searchParams;

  // Fetch store
  const store = await getTenantBySlug(slug);
  if (!store || store.status !== "active") {
    notFound();
  }

  // Redirect if no order ID
  if (!orderId) {
    redirect(`/store/${slug}`);
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
    redirect(`/store/${slug}`);
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
      }
    : null;

  return (
    <OrderSuccessContent
      storeSlug={slug}
      currency={store.currency}
      order={orderData}
      user={user ? { id: user.id } : null}
    />
  );
}
