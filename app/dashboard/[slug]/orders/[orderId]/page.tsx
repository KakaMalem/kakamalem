import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Phone } from "lucide-react";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getDashboardOrderById } from "@/lib/db/queries/orders";
import { getRefundsByOrderId } from "@/lib/db/queries/refunds";
import { canManageStore, hasMinimumRole } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OrderStatusSelect } from "@/components/dashboard/orders/order-status-select";
import { OrderNotesSection } from "@/components/dashboard/orders/order-notes-section";
import { OrderPrintButton } from "@/components/dashboard/orders/order-print-button";
import { OrderPrintReceipt } from "@/components/dashboard/orders/order-print-receipt";
import { OrderPaymentSection } from "@/components/dashboard/orders/order-payment-section";
import { DeliveryLocationMapWrapper } from "@/components/dashboard/orders/delivery-location-map";
import { OrderShipmentSection } from "@/components/dashboard/orders/order-shipment-section";
import { OrderQuickActions } from "@/components/dashboard/orders/order-quick-actions";
import { OrderItemsCard } from "@/components/dashboard/orders/order-items-card";
import { AutoPrintTrigger } from "@/components/dashboard/orders/auto-print-trigger";
import { OrderRefundsSection } from "@/components/dashboard/orders/order-refunds-section";
import { RelativeTime } from "@/components/ui/relative-time";
import {
  formatPostalAddressLines,
  formatRecipientName,
  hasMapLocation,
} from "@/lib/geo/address";

interface OrderDetailPageProps {
  params: Promise<{ slug: string; orderId: string }>;
  searchParams: Promise<{ print?: string }>;
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: OrderDetailPageProps) {
  const { slug, orderId } = await params;
  const { print: shouldPrint } = await searchParams;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const order = await getDashboardOrderById(store.id, orderId);
  if (!order) {
    notFound();
  }

  // Fetch refunds and permissions in parallel
  const [refundsData, canManage, isAdmin] = await Promise.all([
    getRefundsByOrderId(orderId),
    canManageStore(store.id),
    hasMinimumRole(store.id, "admin"),
  ]);

  // Check if order is eligible for refund (has received payment)
  // Typed addresses store 0/0 coordinates, so decide from the address itself
  // whether there is anything to map.
  const deliveryAddressLines = formatPostalAddressLines(order.shippingAddress);
  const showDeliveryMap = hasMapLocation(order.shippingAddress);

  // Guest orders placed through the GPS flow store the phone as the customer
  // name. When the address carries a real name, show that instead.
  const snapshotName = order.customerSnapshot.name?.trim() || "";
  const customerDisplayName =
    snapshotName && snapshotName !== order.customerSnapshot.phone
      ? snapshotName
      : formatRecipientName(order.shippingAddress) || snapshotName || "Customer";

  const amountPaid = parseFloat(order.totalPaid || "0");
  const amountRefunded = parseFloat(order.amountRefunded || "0");
  const canRefund = canManage && amountPaid > amountRefunded;

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
            <div className="text-sm text-muted-foreground">
              <RelativeTime date={order.createdAt} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusSelect
            orderId={order.id}
            tenantId={store.id}
            currentStatus={order.status}
            fulfillmentType={order.fulfillmentType}
            channel={order.channel}
          />
          <OrderPrintButton />
          <OrderQuickActions
            orderId={order.id}
            tenantId={store.id}
            storeSlug={slug}
            orderNumber={order.orderNumber}
            currentStatus={order.status}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content - 2 columns on lg */}
        <div className="space-y-6 lg:col-span-2">
          {/* Order Items */}
          <OrderItemsCard
            items={order.items}
            storeSlug={slug}
            currency={store.currency}
            orderId={order.id}
            tenantId={store.id}
            subtotal={order.subtotal}
            shippingTotal={order.shippingTotal}
            taxTotal={order.taxTotal}
            discountTotal={order.discountTotal}
            total={order.total}
          />

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

          {/* Shipments Section */}
          <OrderShipmentSection shipments={order.shipments} />

          {/* Staff Notes */}
          <OrderNotesSection
            orderId={order.id}
            tenantId={store.id}
            initialNotes={order.staffNotes || ""}
          />

          {/* Refunds Section */}
          <OrderRefundsSection
            tenantId={store.id}
            orderId={order.id}
            orderNumber={order.orderNumber}
            currency={store.currency}
            items={order.items.map((item) => ({
              id: item.id,
              productName: item.productName,
              variantName: item.variantName,
              quantity: item.quantity,
              quantityRefunded: item.quantityRefunded || 0,
              price: item.price,
              subtotal: item.subtotal,
            }))}
            refunds={refundsData}
            amountPaid={amountPaid}
            amountRefunded={amountRefunded}
            canRefund={canRefund}
            canManage={isAdmin}
          />
        </div>

        {/* Sidebar - 1 column on lg */}
        <div className="space-y-6">
          {/* Payment Section */}
          <OrderPaymentSection
            orderId={order.id}
            tenantId={store.id}
            storeSlug={slug}
            currency={store.currency}
            orderTotal={order.total}
            totalPaid={order.totalPaid}
            amountRefunded={order.amountRefunded}
            amountRemaining={order.amountRemaining}
            isPaid={order.isPaid}
            payments={order.payments}
          />

          {/* Customer & Delivery */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer Info */}
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted shrink-0">
                  <span className="text-sm font-medium">
                    {customerDisplayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {customerDisplayName}
                  </p>
                  {order.customerSnapshot.email && (
                    <a
                      href={`mailto:${order.customerSnapshot.email}`}
                      className="text-sm text-muted-foreground hover:underline truncate block"
                    >
                      {order.customerSnapshot.email}
                    </a>
                  )}
                </div>
              </div>

              {/* Contact & Address */}
              {order.shippingAddress && (
                <>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    {/* Phone - prefer shipping address phone, fallback to customer snapshot */}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="size-4 shrink-0" />
                      <a
                        href={`tel:${order.shippingAddress.phone}`}
                        className="hover:underline"
                      >
                        {order.shippingAddress.phone}
                      </a>
                    </div>
                    {/* Address — a typed postal address, otherwise the pin */}
                    {deliveryAddressLines.length > 0 ? (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="size-4 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          {deliveryAddressLines.map((line) => (
                            <p key={line} className="break-words">
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        {order.shippingAddress.city && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="size-4 shrink-0" />
                            <span>{order.shippingAddress.city}</span>
                          </div>
                        )}
                        {order.shippingAddress.plusCode && (
                          <p className="text-xs text-muted-foreground font-mono pl-6">
                            {order.shippingAddress.plusCode}
                          </p>
                        )}
                      </>
                    )}
                    {/* Delivery Notes */}
                    {order.shippingAddress.notes && (
                      <div className="pt-2 mt-2 border-t">
                        <p className="text-muted-foreground">
                          {order.shippingAddress.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Delivery Location Map — only when the order has a real pin.
                  Typed addresses store 0/0, and `{0 && ...}` would render a
                  stray "0" as well as mapping the Gulf of Guinea. */}
              {showDeliveryMap && order.shippingAddress && (
                <>
                  <Separator />
                  <DeliveryLocationMapWrapper
                    latitude={order.shippingAddress.latitude}
                    longitude={order.shippingAddress.longitude}
                    customerName={
                      formatRecipientName(order.shippingAddress) ||
                      order.customerSnapshot.name
                    }
                  />
                </>
              )}
            </CardContent>
          </Card>
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

      {/* Auto-trigger print when ?print=true */}
      {shouldPrint === "true" && <AutoPrintTrigger />}
    </div>
  );
}
