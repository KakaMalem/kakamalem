import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Package,
  Truck,
  MapPin,
  HelpCircle,
  Download,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getUser } from "@/lib/auth/server";
import { resolveTenant } from "@/lib/db/queries/tenants";
import { getStoreBasePath } from "@/lib/utils/store-path";
import {
  getOrderById,
  getOrderStatusInfo,
  getOrderItemsWithImages,
} from "@/lib/db/queries/orders";
import { formatPrice } from "@/lib/utils";
import {
  computePaymentStatus,
  PAYMENT_STATUS_CONFIG,
} from "@/lib/utils/payment-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Address } from "@/lib/db/schema";
import {
  formatCoordinates,
  formatPostalAddressLines,
  formatRecipientName,
  getGoogleMapsUrl,
} from "@/lib/geo/address";

interface OrderDetailPageProps {
  params: Promise<{ slug: string; orderId: string }>;
}

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const { slug, orderId } = await params;

  const store = await resolveTenant(slug);
  if (!store) {
    notFound();
  }

  const user = await getUser();
  if (!user) {
    return null;
  }

  const basePath = await getStoreBasePath(store.slug);

  const order = await getOrderById(orderId, user.id, store.id);
  if (!order) {
    notFound();
  }

  // Fetch order items with images (prioritizes variant images)
  const itemsWithImages = await getOrderItemsWithImages(orderId);
  // Create a map for quick lookup
  const itemImageMap = new Map(
    itemsWithImages.map((item) => [item.id, item.productImage])
  );

  const statusInfo = getOrderStatusInfo(order.status);
  const orderDate = new Date(order.createdAt);
  const shippingAddress = order.shippingAddress as Address;
  // A typed address has no pin (coordinates are stored as 0/0), so show the
  // street lines instead of fake coordinates and skip the map link.
  const recipientName = formatRecipientName(shippingAddress);
  const addressLines = formatPostalAddressLines(shippingAddress);
  const coordinates = formatCoordinates(shippingAddress);
  const mapsUrl = getGoogleMapsUrl(shippingAddress);

  const paymentInfo = computePaymentStatus({
    total: order.total,
    amountPaid: order.amountPaid,
    amountRefunded: order.amountRefunded,
  });
  const paymentConfig = PAYMENT_STATUS_CONFIG[paymentInfo.status];
  const isCOD = order.paymentMethod === "cash";
  const showPayNow =
    !paymentInfo.isPaid &&
    !paymentInfo.isFullyRefunded &&
    !isCOD &&
    order.status !== "cancelled";

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`${basePath}/account/orders`}>
          <ArrowLeft className="mr-2 size-4" />
          Back to Orders
        </Link>
      </Button>

      {/* Order Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="size-5" />
                Order {order.orderNumber}
              </CardTitle>
              <CardDescription>
                Placed on{" "}
                {orderDate.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={statusInfo.color} className="w-fit">
                {statusInfo.label}
              </Badge>
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${paymentConfig.bgColor} ${paymentConfig.textColor}`}
              >
                {paymentConfig.label}
              </span>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`/api/store/${slug}/orders/${orderId}/invoice`}
                  download={`invoice-${order.orderNumber}.pdf`}
                >
                  <Download className="mr-2 size-4" />
                  Invoice
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Payment Status - show when unpaid */}
      {showPayNow && (
        <Alert
          variant="destructive"
          className="border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-600"
        >
          <AlertCircle className="size-4" />
          <AlertTitle>Payment Incomplete</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {paymentInfo.status === "unpaid"
                ? "This order hasn't been paid yet."
                : `Partially paid — ${formatPrice(paymentInfo.amountDue, store.currency)} remaining.`}
            </span>
            <Button size="sm" asChild>
              <Link href={`${basePath}/checkout/payment?order=${order.id}`}>
                <CreditCard className="mr-2 size-4" />
                Pay Now
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {order.items.map((item) => {
            const itemImage = itemImageMap.get(item.id);
            return (
              <div key={item.id} className="flex gap-4">
                {/* Product/variant image */}
                <div className="relative h-16 w-16 shrink-0 rounded-md bg-muted overflow-hidden">
                  {itemImage?.url ? (
                    <Image
                      src={itemImage.url}
                      alt={itemImage.alt || item.productName}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="size-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium line-clamp-1">{item.productName}</p>
                  {item.variantName && (
                    <p className="text-sm text-muted-foreground">
                      {item.variantName}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Qty: {item.quantity} &times;{" "}
                    {formatPrice(parseFloat(item.price), store.currency)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium">
                    {formatPrice(
                      parseFloat(item.price) * item.quantity,
                      store.currency
                    )}
                  </p>
                </div>
              </div>
            );
          })}

          <Separator className="my-4" />

          {/* Order Totals */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>
                {formatPrice(parseFloat(order.subtotal), store.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>
                {parseFloat(order.shippingTotal) === 0
                  ? "Free"
                  : formatPrice(
                      parseFloat(order.shippingTotal),
                      store.currency
                    )}
              </span>
            </div>
            {parseFloat(order.taxTotal) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>
                  {formatPrice(parseFloat(order.taxTotal), store.currency)}
                </span>
              </div>
            )}
            {parseFloat(order.discountTotal) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>
                  -
                  {formatPrice(parseFloat(order.discountTotal), store.currency)}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold text-base">
              <span>Total</span>
              <span>
                {formatPrice(parseFloat(order.total), store.currency)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Location */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="size-5" />
            Delivery Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-1">
            {recipientName && <p className="font-medium">{recipientName}</p>}
            {addressLines.length > 0 ? (
              <div className="flex items-start gap-1 text-muted-foreground">
                <MapPin className="size-3 mt-1 shrink-0" />
                <div className="min-w-0">
                  {addressLines.map((line) => (
                    <p key={line} className="break-words">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              coordinates && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="size-3" />
                  <span>{coordinates}</span>
                </div>
              )
            )}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                View on Google Maps
              </a>
            )}
            {shippingAddress.notes && (
              <p className="text-muted-foreground mt-2">
                {shippingAddress.notes}
              </p>
            )}
            {shippingAddress.phone && (
              <p className="text-muted-foreground mt-2">
                Phone: {shippingAddress.phone}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Shipment Tracking (if any) */}
      {order.shipments && order.shipments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="size-5" />
              Tracking
            </CardTitle>
          </CardHeader>
          <CardContent>
            {order.shipments.map((shipment) => (
              <div key={shipment.id} className="space-y-4">
                {shipment.trackingNumber && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Tracking Number
                    </p>
                    <p className="font-mono">{shipment.trackingNumber}</p>
                    {shipment.carrierName && (
                      <p className="text-sm text-muted-foreground">
                        via {shipment.carrierName}
                      </p>
                    )}
                  </div>
                )}
                {shipment.trackingEvents &&
                  shipment.trackingEvents.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Tracking History</p>
                      <div className="space-y-2">
                        {shipment.trackingEvents.map((event) => (
                          <div
                            key={event.id}
                            className="flex gap-3 text-sm border-l-2 pl-3"
                          >
                            <div className="text-muted-foreground whitespace-nowrap">
                              {new Date(event.eventTime).toLocaleDateString()}
                            </div>
                            <div>
                              <p className="font-medium">{event.status}</p>
                              {event.description && (
                                <p className="text-muted-foreground">
                                  {event.description}
                                </p>
                              )}
                              {event.location && (
                                <p className="text-muted-foreground">
                                  {event.location}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Customer Notes */}
      {order.customerNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Order Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {order.customerNotes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Need Help */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <HelpCircle className="size-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Need help with this order?</p>
              <p className="text-sm text-muted-foreground">
                Contact the store for assistance with your order.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
