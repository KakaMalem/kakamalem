import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Package, MapPin, Phone, Mail } from "lucide-react";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getDashboardOrderById } from "@/lib/db/queries/orders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OrderStatusSelect } from "@/components/dashboard/orders/order-status-select";
import { OrderNotesSection } from "@/components/dashboard/orders/order-notes-section";
import { OrderPrintButton } from "@/components/dashboard/orders/order-print-button";
import { OrderPrintReceipt } from "@/components/dashboard/orders/order-print-receipt";
import { OrderPaymentSection } from "@/components/dashboard/orders/order-payment-section";
import { DeliveryLocationMapWrapper } from "@/components/dashboard/orders/delivery-location-map";

interface OrderDetailPageProps {
  params: Promise<{ slug: string; orderId: string }>;
}

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const { slug, orderId } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const order = await getDashboardOrderById(store.id, orderId);
  if (!order) {
    notFound();
  }

  const formatPrice = (price: string) => {
    return `${parseFloat(price).toLocaleString()} ${store.currency}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/${slug}/orders`}>
              <ArrowLeft className="size-4" />
              <span className="sr-only">Back to orders</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{order.orderNumber}</h1>
            <p className="text-sm text-muted-foreground">
              {formatDate(order.createdAt)} at {formatTime(order.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusSelect
            orderId={order.id}
            tenantId={store.id}
            currentStatus={order.status}
          />
          <OrderPrintButton />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content - 2 columns on lg */}
        <div className="space-y-6 lg:col-span-2">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 px-6 py-4"
                  >
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                      {item.image?.url ? (
                        <Image
                          src={item.image.url}
                          alt={item.image.alt || item.productName}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <Package className="size-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.productName}</p>
                      {item.variantName && (
                        <p className="text-sm text-muted-foreground">
                          {item.variantName}
                        </p>
                      )}
                      {item.sku && (
                        <p className="text-xs text-muted-foreground">
                          SKU: {item.sku}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-medium">{formatPrice(item.price)}</p>
                      <p className="text-sm text-muted-foreground">
                        Qty: {item.quantity}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Totals */}
              <div className="border-t bg-muted/30 px-6 py-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatPrice(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>{formatPrice(order.shippingTotal)}</span>
                  </div>
                  {parseFloat(order.taxTotal) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span>{formatPrice(order.taxTotal)}</span>
                    </div>
                  )}
                  {parseFloat(order.discountTotal) > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>-{formatPrice(order.discountTotal)}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>{formatPrice(order.total)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Notes */}
          {order.customerNotes && (
            <Card>
              <CardHeader>
                <CardTitle>Customer Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {order.customerNotes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Staff Notes */}
          <OrderNotesSection
            orderId={order.id}
            tenantId={store.id}
            initialNotes={order.staffNotes || ""}
          />
        </div>

        {/* Sidebar - 1 column on lg */}
        <div className="space-y-6">
          {/* Payment Section - show for offline/phone orders */}
          {(order.salesChannel === "offline" ||
            order.salesChannel === "phone") && (
            <OrderPaymentSection
              orderId={order.id}
              tenantId={store.id}
              storeSlug={slug}
              currency={store.currency}
              orderTotal={order.total}
              totalPaid={order.totalPaid}
              amountRemaining={order.amountRemaining}
              isPaid={order.isPaid}
              payments={order.payments}
            />
          )}

          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <span className="text-sm font-medium">
                    {order.customerSnapshot.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{order.customerSnapshot.name}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {order.customerSnapshot.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="size-4" />
                    <a
                      href={`mailto:${order.customerSnapshot.email}`}
                      className="hover:underline"
                    >
                      {order.customerSnapshot.email}
                    </a>
                  </div>
                )}
                {order.customerSnapshot.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="size-4" />
                    <a
                      href={`tel:${order.customerSnapshot.phone}`}
                      className="hover:underline"
                    >
                      {order.customerSnapshot.phone}
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Shipping Address - only show for orders with shipping address */}
          {order.shippingAddress && (
            <Card>
              <CardHeader>
                <CardTitle>Shipping Address</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p className="font-medium">
                    {order.shippingAddress.firstName}{" "}
                    {order.shippingAddress.lastName}
                  </p>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Phone className="size-4 mt-0.5" />
                    <span>{order.shippingAddress.phone}</span>
                  </div>
                  {order.shippingAddress.city && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="size-4 mt-0.5" />
                      <span>{order.shippingAddress.city}</span>
                    </div>
                  )}
                  {order.shippingAddress.notes && (
                    <p className="text-muted-foreground pt-2 border-t">
                      {order.shippingAddress.notes}
                    </p>
                  )}
                  {order.shippingAddress.plusCode && (
                    <p className="text-xs text-muted-foreground font-mono">
                      Plus Code: {order.shippingAddress.plusCode}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Delivery Location Map */}
          {order.shippingAddress?.latitude &&
            order.shippingAddress?.longitude && (
              <Card>
                <CardHeader>
                  <CardTitle>Delivery Location</CardTitle>
                </CardHeader>
                <CardContent>
                  <DeliveryLocationMapWrapper
                    latitude={order.shippingAddress.latitude}
                    longitude={order.shippingAddress.longitude}
                    customerName={`${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`}
                  />
                </CardContent>
              </Card>
            )}
        </div>
      </div>

      {/* Print-only receipt (hidden on screen, shown when printing) */}
      <OrderPrintReceipt
        order={order}
        storeName={store.name}
        storeLogo={store.logoUrl}
        storePhone={store.contactPhone}
        storeEmail={store.contactEmail}
        currency={store.currency}
        receiptSettings={{
          paperWidth: store.receiptPaperWidth,
          showLogo: store.receiptShowLogo,
          showContact: store.receiptShowContact,
          footerText: store.receiptFooterText,
        }}
      />
    </div>
  );
}
