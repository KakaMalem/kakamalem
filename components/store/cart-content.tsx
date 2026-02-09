"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CartItem } from "./cart-item";
import { CartSummary } from "./cart-summary";
import { EmptyCart } from "./empty-cart";
import { useCart } from "@/lib/hooks/use-cart";
import { useCartCampaignDiscounts } from "@/lib/hooks/use-campaign-discounts";

interface CartContentProps {
  storeSlug: string;
  currency: string;
  checkoutEnabled?: boolean;
  contactPhone?: string | null;
  tenantId: string;
}

export function CartContent({
  storeSlug,
  currency,
  checkoutEnabled = true,
  contactPhone,
  tenantId,
}: CartContentProps) {
  const { items, clearCart, isClearing } = useCart();

  // Fetch campaign discounts for cart items
  const { discountsMap } = useCartCampaignDiscounts(tenantId, items);

  if (items.length === 0) {
    return <EmptyCart storeSlug={storeSlug} />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Shopping Cart
          </h1>
          <p className="mt-1 text-muted-foreground">
            {items.length} {items.length === 1 ? "item" : "items"} in your cart
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/store/${storeSlug}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Continue Shopping
            </Link>
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                disabled={isClearing}
              >
                {isClearing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Clear Cart
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear shopping cart?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all {items.length}{" "}
                  {items.length === 1 ? "item" : "items"} from your cart. This
                  action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={clearCart}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Clear Cart
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Cart Content */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          <div className="space-y-4">
            {items.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                currency={currency}
                campaignDiscount={discountsMap.get(item.product.id)}
              />
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <CartSummary
              storeSlug={storeSlug}
              currency={currency}
              checkoutEnabled={checkoutEnabled}
              contactPhone={contactPhone}
              tenantId={tenantId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
