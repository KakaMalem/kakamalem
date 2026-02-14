"use client";

import Link from "next/link";
import Image from "next/image";
import { Package, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useImagePreview } from "@/components/ui/image-preview";
import { cn } from "@/lib/utils";
import { OrderShippingAdjustment } from "./order-shipping-adjustment";
import { OrderTotalAdjustment } from "./order-total-adjustment";

interface OrderItem {
  id: string;
  productId: string | null;
  productSlug: string | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  price: string;
  quantity: number;
  subtotal: string;
  image: {
    url: string;
    alt: string | null;
  } | null;
}

interface OrderItemsCardProps {
  items: OrderItem[];
  storeSlug: string;
  currency: string;
  orderId: string;
  tenantId: string;
  subtotal: string;
  shippingTotal: string;
  taxTotal: string;
  discountTotal: string;
  total: string;
}

export function OrderItemsCard({
  items,
  storeSlug,
  currency,
  orderId,
  tenantId,
  subtotal,
  shippingTotal,
  taxTotal,
  discountTotal,
  total,
}: OrderItemsCardProps) {
  const { openPreview } = useImagePreview();

  const formatPrice = (price: string) => {
    return `${parseFloat(price).toLocaleString()} ${currency}`;
  };

  const handleImageClick = (item: OrderItem) => {
    if (item.image?.url) {
      openPreview(
        [{ src: item.image.url, alt: item.image.alt || item.productName }],
        0
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Items</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-4 px-6 py-4">
              {/* Product Image - clickable for preview */}
              <button
                type="button"
                onClick={() => handleImageClick(item)}
                disabled={!item.image?.url}
                className={cn(
                  "relative size-14 shrink-0 overflow-hidden rounded-md bg-muted",
                  item.image?.url &&
                    "cursor-pointer ring-offset-background transition-all hover:ring-2 hover:ring-ring hover:ring-offset-2"
                )}
              >
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
              </button>

              {/* Product Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {item.productSlug ? (
                    <Link
                      href={`/store/${storeSlug}/product/${item.productSlug}`}
                      target="_blank"
                      className="font-medium hover:underline inline-flex items-center gap-0.5"
                    >
                      {item.productName}
                      <ArrowUpRight className="size-3.5 text-muted-foreground shrink-0" />
                    </Link>
                  ) : (
                    <p className="font-medium">{item.productName}</p>
                  )}
                </div>
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

              {/* Price & Quantity */}
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
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Shipping</span>
                <OrderShippingAdjustment
                  orderId={orderId}
                  tenantId={tenantId}
                  currency={currency}
                  currentShipping={shippingTotal}
                  subtotal={subtotal}
                />
              </div>
              <span>{formatPrice(shippingTotal)}</span>
            </div>
            {parseFloat(taxTotal) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatPrice(taxTotal)}</span>
              </div>
            )}
            {parseFloat(discountTotal) > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-{formatPrice(discountTotal)}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <OrderTotalAdjustment
                orderId={orderId}
                tenantId={tenantId}
                currency={currency}
                subtotal={subtotal}
                shippingTotal={shippingTotal}
                taxTotal={taxTotal}
                discountTotal={discountTotal}
                currentTotal={total}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
