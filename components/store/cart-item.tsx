"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice, cn } from "@/lib/utils";
import { useDebouncedCartSync } from "@/lib/hooks/use-debounced-cart-sync";

import type { CartItem as CartItemType } from "@/lib/stores/use-cart-store";

interface CartItemProps {
  item: CartItemType;
  tenantId: string;
  storeSlug: string;
  currency: string;
}

export function CartItem({
  item,
  tenantId,
  storeSlug,
  currency,
}: CartItemProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  // Only track local input value while actively editing
  const [editingValue, setEditingValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { updateQuantity, isItemSyncing } = useDebouncedCartSync({
    tenantId,
    storeSlug,
  });

  const isSyncing = isItemSyncing(item.id);

  const price = item.variant?.price
    ? parseFloat(item.variant.price)
    : parseFloat(item.product.price);

  const availableStock = item.variant ? item.variant.stock : item.product.stock;
  const trackInventory = item.product.trackInventory;
  const allowBackorder = item.product.allowBackorder;
  const isLowStock =
    trackInventory &&
    !allowBackorder &&
    availableStock <= 5 &&
    availableStock > 0;
  const hasStockIssue =
    trackInventory && !allowBackorder && item.quantity > availableStock;

  const productName = item.variant?.displayName
    ? `${item.product.name} - ${item.variant.displayName}`
    : item.product.name;

  // Display value: use editingValue while editing, otherwise item.quantity
  const displayValue = isEditing ? editingValue : String(item.quantity);

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity < 1) {
      // Will be handled by remove
      return;
    }

    // Check stock
    if (trackInventory && !allowBackorder && newQuantity > availableStock) {
      toast.error(`Only ${availableStock} items available`);
      return;
    }

    // Use debounced sync - it handles optimistic updates internally
    updateQuantity(item.id, newQuantity, item.quantity);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty string for typing, or valid positive integers
    if (value === "" || /^\d+$/.test(value)) {
      setEditingValue(value);
    }
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    const parsed = parseInt(editingValue, 10);

    if (isNaN(parsed) || parsed < 1) {
      // Reset - displayValue will automatically show item.quantity
      return;
    }

    if (parsed !== item.quantity) {
      handleQuantityChange(parsed);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      inputRef.current?.blur();
    }
  };

  const handleInputFocus = () => {
    setIsEditing(true);
    setEditingValue(String(item.quantity));
    // Select all text on focus for easy replacement
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleRemove = () => {
    if (isRemoving) return;

    setIsRemoving(true);

    // Use debounced sync for removal (quantity = 0)
    // The hook handles optimistic removal and server sync
    updateQuantity(item.id, 0, item.quantity);
    toast.success("Item removed from cart");

    // Note: isRemoving stays true to prevent double-clicks
    // The item will be removed from the list via optimistic update
  };

  return (
    <div
      className={cn(
        "flex gap-4 rounded-lg border p-4 transition-opacity",
        (isSyncing || isRemoving) && "opacity-60"
      )}
    >
      {/* Product Image */}
      <Link
        href={`/store/${storeSlug}/product/${item.product.slug}`}
        className="relative aspect-square h-24 w-24 shrink-0 overflow-hidden rounded-md bg-muted"
      >
        {item.product.image ? (
          <Image
            src={item.product.image.url}
            alt={item.product.image.altText || item.product.name}
            fill
            className="object-cover"
            sizes="96px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            No image
          </div>
        )}
      </Link>

      {/* Product Info */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link
              href={`/store/${storeSlug}/product/${item.product.slug}`}
              className="line-clamp-2 font-medium hover:underline"
            >
              {productName}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatPrice(price, currency)} each
            </p>
          </div>

          {/* Remove Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={handleRemove}
            disabled={isRemoving}
            aria-label="Remove item"
          >
            {isRemoving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Stock Warning */}
        {hasStockIssue && (
          <div className="mt-2 flex items-center gap-1.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Only {availableStock} available</span>
          </div>
        )}
        {isLowStock && !hasStockIssue && (
          <div className="mt-2 flex items-center gap-1.5 text-sm text-amber-600">
            <AlertCircle className="h-4 w-4" />
            <span>Only {availableStock} left</span>
          </div>
        )}

        {/* Quantity & Subtotal */}
        <div className="mt-auto flex items-center justify-between pt-3">
          {/* Quantity Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleQuantityChange(item.quantity - 1)}
              disabled={item.quantity <= 1}
              aria-label="Decrease quantity"
            >
              <Minus className="h-3 w-3" />
            </Button>

            {/* Editable quantity input */}
            <Input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={displayValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              onFocus={handleInputFocus}
              className="h-8 w-16 text-center text-sm font-medium [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              disabled={isSyncing}
              aria-label="Quantity"
            />

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleQuantityChange(item.quantity + 1)}
              disabled={
                trackInventory &&
                !allowBackorder &&
                item.quantity >= availableStock
              }
              aria-label="Increase quantity"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {/* Subtotal */}
          <p className="font-semibold">
            {formatPrice(price * item.quantity, currency)}
          </p>
        </div>
      </div>
    </div>
  );
}
