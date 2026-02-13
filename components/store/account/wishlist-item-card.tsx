"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Trash2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { removeWishlistItemAction } from "@/lib/actions/wishlists";
import { useCurrencyStore } from "@/lib/stores/use-currency-store";
import { toast } from "sonner";

interface WishlistItemCardProps {
  item: {
    id: string;
    productId: string;
    variantId: string | null;
    note: string | null;
    addedAt: string;
    product: {
      id: string;
      name: string;
      slug: string;
      price: string;
      status: string;
      hasVariants: boolean;
      stock: number;
      trackInventory: boolean;
    };
    productImage: {
      id: string | null;
      url: string | null;
      alt: string | null;
    } | null;
  };
  storeSlug: string;
  currency: string;
}

export function WishlistItemCard({
  item,
  storeSlug,
  currency: _currency,
}: WishlistItemCardProps) {
  const { format: formatPrice } = useCurrencyStore();
  const [isRemoving, setIsRemoving] = useState(false);

  const isOutOfStock = item.product.trackInventory && item.product.stock <= 0;
  const isAvailable = item.product.status === "active" && !isOutOfStock;
  const isLowStock =
    item.product.trackInventory &&
    item.product.stock > 0 &&
    item.product.stock <= 5;

  async function handleRemove() {
    setIsRemoving(true);
    try {
      const result = await removeWishlistItemAction(item.id);
      if (result.error) {
        toast.error(result.error.message);
      } else {
        toast.success("Removed from wishlist");
      }
    } catch {
      toast.error("Failed to remove item");
    } finally {
      setIsRemoving(false);
    }
  }

  const productUrl = `/store/${storeSlug}/product/${item.product.slug}`;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Product Image */}
          <Link href={productUrl} className="shrink-0">
            <div className="relative h-24 w-24 overflow-hidden rounded-md bg-muted">
              {item.productImage?.url ? (
                <Image
                  src={item.productImage.url}
                  alt={item.productImage.alt || item.product.name}
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  No image
                </div>
              )}
              {!isAvailable && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <Badge variant="secondary">Unavailable</Badge>
                </div>
              )}
            </div>
          </Link>

          {/* Product Info */}
          <div className="flex min-w-0 flex-1 flex-col">
            <Link
              href={productUrl}
              className="font-medium hover:underline line-clamp-2"
            >
              {item.product.name}
            </Link>

            {/* Price */}
            <div className="mt-1 flex items-center gap-2">
              <span className="font-semibold">
                {item.product.hasVariants ? "From " : ""}
                {formatPrice(parseFloat(item.product.price))}
              </span>
            </div>

            {/* Stock Status */}
            <div className="mt-1">
              {isOutOfStock ? (
                <Badge variant="destructive" className="text-xs">
                  Out of Stock
                </Badge>
              ) : isLowStock ? (
                <Badge variant="secondary" className="text-xs">
                  Low Stock
                </Badge>
              ) : null}
            </div>

            {/* Note */}
            {item.note && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                {item.note}
              </p>
            )}

            {/* Actions */}
            <div className="mt-auto flex gap-2 pt-2">
              {isAvailable && (
                <Button size="sm" variant="outline" asChild>
                  <Link href={productUrl}>
                    <ShoppingCart className="mr-2 size-4" />
                    View Product
                  </Link>
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRemove}
                disabled={isRemoving}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
                <span className="sr-only">Remove from wishlist</span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
