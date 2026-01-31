import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, CreditCard, ArrowLeft } from "lucide-react";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getOrderById } from "@/lib/db/queries/orders";
import { getUser } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatPrice } from "@/lib/utils";
import { PaymentRetryButton } from "@/components/store/checkout/payment-retry-button";

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

  const wasCancelled = cancelled === "true";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-100">
          {wasCancelled ? (
            <AlertCircle className="size-8 text-amber-600" />
          ) : (
            <CreditCard className="size-8 text-amber-600" />
          )}
        </div>
        <h1 className="mt-4 text-2xl font-bold">
          {wasCancelled ? "Payment Cancelled" : "Complete Your Payment"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {wasCancelled
            ? "Your payment was cancelled. You can try again or cancel the order."
            : "Your order is waiting for payment."}
        </p>
      </div>

      {wasCancelled && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="size-4" />
          <AlertTitle>Payment was cancelled</AlertTitle>
          <AlertDescription>
            Don&apos;t worry - your order is saved. You can complete payment now
            or come back later.
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Order Number</span>
            <span className="font-mono font-medium">{order.orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Items</span>
            <span>{order.items.length} items</span>
          </div>
          <div className="flex justify-between border-t pt-4">
            <span className="font-semibold">Amount Due</span>
            <span className="font-semibold">
              {formatPrice(
                parseFloat(order.amountDue || order.total),
                store.currency
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <PaymentRetryButton
          orderId={orderId}
          amount={parseFloat(order.amountDue || order.total)}
          currency={store.currency}
        />

        <Button variant="outline" className="w-full" asChild>
          <Link href={`/store/${slug}`}>
            <ArrowLeft className="mr-2 size-4" />
            Continue Shopping
          </Link>
        </Button>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Your order will be confirmed once payment is complete. If you have any
        issues, please contact the store.
      </p>
    </div>
  );
}
