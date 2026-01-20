import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, Package, ArrowRight, ShoppingBag } from "lucide-react";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getOrderById } from "@/lib/db/queries/orders";
import { getUser } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/lib/utils";
import { formatPlusCodeForDisplay } from "@/lib/geo";
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

  const shippingAddress = order?.shippingAddress as Address | undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        {/* Success Icon */}
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="size-10 text-green-600" />
        </div>

        {/* Heading */}
        <h1 className="mt-6 text-3xl font-bold">Thank you for your order!</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Your order has been placed and is being processed.
        </p>

        {/* Order Details */}
        {order && (
          <Card className="mt-8 text-left">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Order Number</p>
                  <p className="text-lg font-semibold">{order.orderNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {new Date(order.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Items Summary */}
              <div className="space-y-3">
                <p className="font-medium">Items ({order.items.length})</p>
                {order.items.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded bg-muted">
                      <Package className="size-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">
                        {item.productName}
                      </p>
                      {item.variantName && (
                        <p className="text-xs text-muted-foreground">
                          {item.variantName}
                        </p>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      &times;{item.quantity}
                    </div>
                  </div>
                ))}
                {order.items.length > 3 && (
                  <p className="text-sm text-muted-foreground">
                    +{order.items.length - 3} more items
                  </p>
                )}
              </div>

              <Separator className="my-4" />

              {/* Delivery Location */}
              {shippingAddress && (
                <div>
                  <p className="font-medium mb-2">Delivering to</p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      {shippingAddress.firstName} {shippingAddress.lastName}
                    </p>
                    <p className="font-mono">
                      {shippingAddress.plusCode
                        ? formatPlusCodeForDisplay(
                            shippingAddress.plusCode,
                            shippingAddress.city
                          )
                        : `${shippingAddress.latitude.toFixed(
                            6
                          )}, ${shippingAddress.longitude.toFixed(6)}`}
                    </p>
                    <a
                      href={`https://www.google.com/maps?q=${shippingAddress.latitude},${shippingAddress.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      View on Google Maps
                    </a>
                    {shippingAddress.notes && (
                      <p className="mt-1">{shippingAddress.notes}</p>
                    )}
                  </div>
                </div>
              )}

              <Separator className="my-4" />

              {/* Total */}
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>
                  {formatPrice(parseFloat(order.total), store.currency)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Guest Order (no order details) */}
        {!order && (
          <Card className="mt-8">
            <CardContent className="p-6">
              <p className="text-muted-foreground">
                We&apos;ve sent a confirmation email with your order details.
              </p>
            </CardContent>
          </Card>
        )}

        {/* What's Next */}
        <div className="mt-8 rounded-lg border bg-muted/30 p-6 text-left">
          <h2 className="font-semibold">What happens next?</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                1
              </span>
              <span>
                We&apos;ll send you an email confirmation with your order
                details.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                2
              </span>
              <span>
                Once your order ships, you&apos;ll receive tracking information.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                3
              </span>
              <span>
                Your order will be delivered to your shipping address.
              </span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {user && order && (
            <Button asChild>
              <Link href={`/store/${slug}/account/orders/${order.id}`}>
                View Order Details
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href={`/store/${slug}`}>
              <ShoppingBag className="mr-2 size-4" />
              Continue Shopping
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
