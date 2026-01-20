"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, Loader2, AlertCircle, Tag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice, cn } from "@/lib/utils";
import { useCart, getApplicableTierPrice } from "@/lib/hooks/use-cart";

import type { CartItem as CartItemType } from "@/lib/types/cart";

interface CartItemProps {
  item: CartItemType;
  currency: string;
}

export function CartItem({ item, currency }: CartItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingValue, setEditingValue] = useState("");
  // Local quantity for immediate UI feedback
  const [localQuantity, setLocalQuantity] = useState(item.quantity);
  const inputRef = useRef<HTMLInputElement>(null);

  // Refs for debouncing
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingQuantityRef = useRef<number | null>(null);

  const { updateQuantity, removeItem, isRemovingItem } = useCart();

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Sync localQuantity from server when item.quantity changes externally
  // The debounce logic handles reconciliation - any mid-click server response
  // will be overwritten by the next debounced update with the correct value
  const [prevItemQuantity, setPrevItemQuantity] = useState(item.quantity);
  if (prevItemQuantity !== item.quantity) {
    setPrevItemQuantity(item.quantity);
    setLocalQuantity(item.quantity);
  }

  const isRemoving = isRemovingItem(item.id);

  const basePrice = item.variant?.price
    ? parseFloat(item.variant.price)
    : parseFloat(item.product.price);

  // Calculate tier pricing using local quantity for responsive UI
  const effectivePrice = useMemo(
    () =>
      getApplicableTierPrice(
        basePrice,
        localQuantity,
        item.product.priceTiers || []
      ),
    [basePrice, localQuantity, item.product.priceTiers]
  );

  const hasTierDiscount = effectivePrice < basePrice;
  const savingsPerUnit = hasTierDiscount ? basePrice - effectivePrice : 0;
  const totalSavings = savingsPerUnit * localQuantity;

  const availableStock = item.variant ? item.variant.stock : item.product.stock;
  const trackInventory = item.product.trackInventory;
  const allowBackorder = item.product.allowBackorder;
  const isLowStock =
    trackInventory &&
    !allowBackorder &&
    availableStock <= 5 &&
    availableStock > 0;
  const hasStockIssue =
    trackInventory && !allowBackorder && localQuantity > availableStock;

  const productName = item.variant?.displayName
    ? `${item.product.name} - ${item.variant.displayName}`
    : item.product.name;

  // Display value: use editingValue while editing, otherwise localQuantity
  const displayValue = isEditing ? editingValue : String(localQuantity);

  // Debounced server update - only sends after user stops clicking
  const debouncedServerUpdate = (quantity: number) => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Mark that we have a pending update
    pendingQuantityRef.current = quantity;

    // Schedule the actual server update
    debounceTimerRef.current = setTimeout(() => {
      const finalQuantity = pendingQuantityRef.current;
      pendingQuantityRef.current = null;
      debounceTimerRef.current = null;

      if (finalQuantity !== null) {
        updateQuantity(item.id, finalQuantity);
      }
    }, 300); // 300ms debounce
  };

  const handleQuantityChange = (delta: number) => {
    const newQuantity = localQuantity + delta;

    if (newQuantity < 1) {
      return;
    }

    // Check stock
    if (trackInventory && !allowBackorder && newQuantity > availableStock) {
      toast.error(`Only ${availableStock} items available`);
      return;
    }

    // Update local state immediately for responsive UI
    setLocalQuantity(newQuantity);
    // Debounce the server update
    debouncedServerUpdate(newQuantity);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d+$/.test(value)) {
      setEditingValue(value);
    }
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    const parsed = parseInt(editingValue, 10);

    if (isNaN(parsed) || parsed < 1) {
      // Reset to current quantity if invalid
      setEditingValue(String(localQuantity));
      return;
    }

    if (parsed !== localQuantity) {
      if (trackInventory && !allowBackorder && parsed > availableStock) {
        toast.error(`Only ${availableStock} items available`);
        setEditingValue(String(localQuantity));
        return;
      }
      setLocalQuantity(parsed);
      debouncedServerUpdate(parsed);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditingValue(String(localQuantity));
      inputRef.current?.blur();
    }
  };

  const handleInputFocus = () => {
    setIsEditing(true);
    setEditingValue(String(localQuantity));
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleRemove = () => {
    removeItem(item.id);
  };

  // Get store slug from the cart store for links
  const { storeSlug } = useCart();

  return (
    <div
      className={cn(
        "flex gap-4 rounded-lg border p-4 transition-opacity",
        isRemoving && "opacity-60"
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
            <div className="mt-1 flex items-center gap-2">
              {hasTierDiscount ? (
                <>
                  <span className="text-sm font-medium text-green-600">
                    {formatPrice(effectivePrice, currency)}
                  </span>
                  <span className="text-sm text-muted-foreground line-through">
                    {formatPrice(basePrice, currency)}
                  </span>
                  <span className="text-xs text-green-600">each</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {formatPrice(basePrice, currency)} each
                </span>
              )}
            </div>
            {hasTierDiscount && (
              <div className="mt-1 flex items-center gap-1 text-xs text-green-600">
                <Tag className="h-3 w-3" />
                <span>Bulk discount applied</span>
              </div>
            )}
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
              onClick={() => handleQuantityChange(-1)}
              disabled={localQuantity <= 1}
              aria-label="Decrease quantity"
            >
              <Minus className="h-3 w-3" />
            </Button>

            <Input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={displayValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              onFocus={handleInputFocus}
              className="h-8 w-20 text-center text-sm font-medium [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label="Quantity"
            />

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleQuantityChange(+1)}
              disabled={
                trackInventory &&
                !allowBackorder &&
                localQuantity >= availableStock
              }
              aria-label="Increase quantity"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {/* Subtotal */}
          <div className="text-right">
            <p className="font-semibold">
              {formatPrice(effectivePrice * localQuantity, currency)}
            </p>
            {hasTierDiscount && totalSavings > 0 && (
              <p className="text-xs text-green-600">
                Save {formatPrice(totalSavings, currency)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
