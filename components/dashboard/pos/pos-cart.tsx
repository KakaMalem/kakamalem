"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Minus,
  Plus,
  Trash2,
  Package,
  ShoppingCart,
  Tag,
  Percent,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn, formatPrice } from "@/lib/utils";

export type POSCartItem = {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  price: number;
  originalPrice: number;
  quantity: number;
  trackInventory: boolean;
  image: string | null;
  maxStock: number;
};

interface POSCartProps {
  items: POSCartItem[];
  currency: string;
  discountType: "amount" | "percent";
  discountValue: number;
  onUpdateQuantity: (id: string, delta: number) => void;
  onSetQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onDiscountTypeChange: (type: "amount" | "percent") => void;
  onDiscountValueChange: (value: number) => void;
}

const DISCOUNT_PRESETS = [5, 10, 15, 20];

export function POSCart({
  items,
  currency,
  discountType,
  discountValue,
  onUpdateQuantity,
  onSetQuantity,
  onRemoveItem,
  onClearCart,
  onDiscountTypeChange,
  onDiscountValueChange,
}: POSCartProps) {
  const [discountExpanded, setDiscountExpanded] = useState(false);

  // Calculate totals
  const subtotal = items.reduce(
    (sum, item) => sum + item.originalPrice * item.quantity,
    0
  );
  const itemLevelDiscount = items.reduce(
    (sum, item) => sum + (item.originalPrice - item.price) * item.quantity,
    0
  );
  const manualDiscount =
    discountType === "percent"
      ? Math.round(
          (subtotal - itemLevelDiscount) * (discountValue / 100) * 100
        ) / 100
      : Math.min(discountValue, subtotal - itemLevelDiscount);
  const totalDiscount = itemLevelDiscount + manualDiscount;
  const total = Math.max(0, subtotal - totalDiscount);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // For fixed discount: the max price is what user can set (original total before manual discount)
  const maxPriceForFixed = subtotal - itemLevelDiscount;
  // The displayed new price (what user sees/edits in fixed mode)
  const displayedNewPrice = maxPriceForFixed - discountValue;

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-card">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="size-5" />
          <h2 className="font-semibold">Cart</h2>
          {itemCount > 0 && <Badge variant="secondary">{itemCount}</Badge>}
        </div>
        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive h-9"
            onClick={onClearCart}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Cart Items */}
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
          <ShoppingCart className="mb-3 size-12 opacity-40" />
          <p className="font-medium">Cart is empty</p>
          <p className="text-sm">Tap products to add</p>
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="divide-y px-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-3">
                  {/* Image */}
                  <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.productName}
                        width={56}
                        height={56}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <Package className="size-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">
                      {item.productName}
                    </p>
                    {item.variantName && (
                      <p className="truncate text-xs text-muted-foreground">
                        {item.variantName}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-medium">
                        {formatPrice(item.price * item.quantity, currency)}
                      </span>
                      {item.price < item.originalPrice && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatPrice(
                            item.originalPrice * item.quantity,
                            currency
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-10"
                      onClick={() =>
                        item.quantity === 1
                          ? onRemoveItem(item.id)
                          : onUpdateQuantity(item.id, -1)
                      }
                    >
                      {item.quantity === 1 ? (
                        <Trash2 className="size-4 text-destructive" />
                      ) : (
                        <Minus className="size-4" />
                      )}
                    </Button>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={item.quantity === 0 ? "" : item.quantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^\d+$/.test(val)) {
                          const num = val === "" ? 0 : parseInt(val);
                          onSetQuantity(item.id, num);
                        }
                      }}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (isNaN(val) || val < 1) {
                          onSetQuantity(item.id, 1);
                        }
                      }}
                      onFocus={(e) => {
                        // Select all text when focusing for easy replacement
                        e.target.select();
                      }}
                      onKeyDown={(e) => {
                        // Arrow key support for quantity adjustment
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          if (
                            !item.trackInventory ||
                            item.quantity < item.maxStock
                          ) {
                            onUpdateQuantity(item.id, 1);
                          }
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          if (item.quantity > 1) {
                            onUpdateQuantity(item.id, -1);
                          }
                        }
                      }}
                      className="h-10 w-12 text-center px-1 text-base font-medium"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-10"
                      onClick={() => onUpdateQuantity(item.id, 1)}
                      disabled={
                        item.trackInventory && item.quantity >= item.maxStock
                      }
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="shrink-0 border-t bg-muted/30 px-4 py-3">
            {/* Discount Toggle */}
            <Collapsible
              open={discountExpanded}
              onOpenChange={setDiscountExpanded}
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between py-2 -my-2 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors">
                <div className="flex items-center gap-2">
                  <Tag className="size-4 text-green-600" />
                  <span className="text-sm font-medium">Discount</span>
                  {manualDiscount > 0 && (
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-700"
                    >
                      {discountType === "percent"
                        ? `-${discountValue}%`
                        : `-${formatPrice(discountValue, currency)}`}
                    </Badge>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    discountExpanded && "rotate-180"
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pt-3 space-y-3">
                  {/* Type toggle */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={
                        discountType === "percent" ? "default" : "outline"
                      }
                      size="sm"
                      className="flex-1 h-10"
                      onClick={() => {
                        onDiscountTypeChange("percent");
                        onDiscountValueChange(0);
                      }}
                    >
                      <Percent className="mr-1.5 size-4" />%
                    </Button>
                    <Button
                      type="button"
                      variant={
                        discountType === "amount" ? "default" : "outline"
                      }
                      size="sm"
                      className="flex-1 h-10"
                      onClick={() => {
                        onDiscountTypeChange("amount");
                        onDiscountValueChange(0);
                      }}
                    >
                      <Tag className="mr-1.5 size-4" />
                      Set Price
                    </Button>
                  </div>

                  {/* Presets */}
                  {discountType === "percent" && (
                    <div className="grid grid-cols-4 gap-2">
                      {DISCOUNT_PRESETS.map((preset) => (
                        <Button
                          key={preset}
                          type="button"
                          variant={
                            discountValue === preset ? "default" : "outline"
                          }
                          size="sm"
                          className="h-10"
                          onClick={() =>
                            onDiscountValueChange(
                              discountValue === preset ? 0 : preset
                            )
                          }
                        >
                          {preset}%
                        </Button>
                      ))}
                    </div>
                  )}

                  {/* Custom input */}
                  {discountType === "percent" ? (
                    <div className="relative">
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max={100}
                        value={discountValue || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (isNaN(val) || val < 0) {
                            onDiscountValueChange(0);
                          } else if (val > 100) {
                            onDiscountValueChange(100);
                          } else {
                            onDiscountValueChange(val);
                          }
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder="Custom %"
                        className="pr-12 h-10"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        %
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Original price:</span>
                        <span>{formatPrice(maxPriceForFixed, currency)}</span>
                      </div>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={maxPriceForFixed}
                          value={
                            discountValue === 0
                              ? maxPriceForFixed || ""
                              : displayedNewPrice
                          }
                          onChange={(e) => {
                            const newPrice = parseFloat(e.target.value);
                            if (isNaN(newPrice) || newPrice < 0) {
                              // If empty or negative, set discount to full (price = 0)
                              onDiscountValueChange(maxPriceForFixed);
                            } else if (newPrice > maxPriceForFixed) {
                              // Can't set price higher than original
                              onDiscountValueChange(0);
                            } else {
                              // Calculate discount from new price
                              const discount = maxPriceForFixed - newPrice;
                              onDiscountValueChange(
                                Math.round(discount * 100) / 100
                              );
                            }
                          }}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder={formatPrice(maxPriceForFixed, currency)}
                          className="pr-12 h-10"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          {currency}
                        </span>
                      </div>
                      {discountValue > 0 && (
                        <p className="text-xs text-green-600">
                          Discount: -{formatPrice(discountValue, currency)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator className="my-3" />

            {/* Totals */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(subtotal, currency)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatPrice(totalDiscount, currency)}</span>
                </div>
              )}
            </div>
            <Separator className="my-3" />
            <div className="flex justify-between text-xl font-bold">
              <span>Total</span>
              <span>{formatPrice(total, currency)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Export totals calculation for use in parent
export function calculateCartTotals(
  items: POSCartItem[],
  discountType: "amount" | "percent",
  discountValue: number
) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.originalPrice * item.quantity,
    0
  );
  const itemLevelDiscount = items.reduce(
    (sum, item) => sum + (item.originalPrice - item.price) * item.quantity,
    0
  );
  const manualDiscount =
    discountType === "percent"
      ? Math.round(
          (subtotal - itemLevelDiscount) * (discountValue / 100) * 100
        ) / 100
      : Math.min(discountValue, subtotal - itemLevelDiscount);
  const totalDiscount = itemLevelDiscount + manualDiscount;
  const total = Math.max(0, subtotal - totalDiscount);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    subtotal,
    itemLevelDiscount,
    manualDiscount,
    totalDiscount,
    total,
    itemCount,
  };
}
