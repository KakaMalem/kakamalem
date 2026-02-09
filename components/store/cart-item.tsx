"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, AlertCircle, Tag, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils";
import { useCart, getApplicableTierPrice } from "@/lib/hooks/use-cart";
import {
  applyCampaignDiscount,
  type CampaignDiscount,
} from "@/lib/utils/pricing-display";

import type { CartItem as CartItemType } from "@/lib/types/cart";

interface CartItemProps {
  item: CartItemType;
  currency: string;
  /** Optional campaign discount for this product */
  campaignDiscount?: CampaignDiscount | null;
}

export function CartItem({ item, currency, campaignDiscount }: CartItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingValue, setEditingValue] = useState("");
  // Local quantity is the single source of truth during user interaction
  // This prevents jitter when server responses arrive during rapid clicking
  const [localQuantity, setLocalQuantity] = useState(item.quantity);
  // When true, local state is "locked" and ignores server updates
  // This becomes true on user interaction and false after cooldown
  const [isLocalLocked, setIsLocalLocked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Refs for debouncing
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingQuantityRef = useRef<number | null>(null);
  const lockTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Disable the mutation-level debounce since we handle debouncing locally
  // This gives us precise control over optimistic updates
  const { updateQuantity, removeItem, isRemovingItem } = useCart({
    debounce: false,
  });

  // Track if this specific item is being removed to prevent duplicate calls
  const isRemoving = isRemovingItem(item.id);

  // Cleanup timers on unmount
  useEffect(() => {
    const debounceTimer = debounceTimerRef.current;
    const lockTimer = lockTimeoutRef.current;
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      if (lockTimer) {
        clearTimeout(lockTimer);
      }
    };
  }, []);

  // Sync from server during render (React recommended pattern for derived state)
  // Only sync when local state is NOT locked by user interaction
  const [prevItemQuantity, setPrevItemQuantity] = useState(item.quantity);
  if (prevItemQuantity !== item.quantity) {
    setPrevItemQuantity(item.quantity);
    // Only accept server updates if user hasn't interacted recently
    // This is the key fix: ignore server updates while user is actively clicking
    if (!isLocalLocked) {
      setLocalQuantity(item.quantity);
    }
  }

  const originalBasePrice = item.variant?.price
    ? parseFloat(item.variant.price)
    : parseFloat(item.product.price);

  // Apply campaign discount to base price first (if applicable)
  const basePrice = campaignDiscount
    ? applyCampaignDiscount(originalBasePrice, campaignDiscount)
    : originalBasePrice;

  const hasCampaignDiscount = campaignDiscount && basePrice < originalBasePrice;

  // Calculate tier pricing using local quantity for responsive UI
  // Tier pricing applies on top of campaign-discounted price
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
  const tierSavingsPerUnit = hasTierDiscount ? basePrice - effectivePrice : 0;
  const totalTierSavings = tierSavingsPerUnit * localQuantity;

  // Total savings from all discounts
  const campaignSavingsPerUnit = hasCampaignDiscount
    ? originalBasePrice - basePrice
    : 0;
  const totalCampaignSavings = campaignSavingsPerUnit * localQuantity;
  const totalSavings = totalTierSavings + totalCampaignSavings;

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

  // Lock local state to prevent server sync from overwriting during interaction
  const lockLocalState = () => {
    setIsLocalLocked(true);
    // Clear any existing unlock timeout
    if (lockTimeoutRef.current) {
      clearTimeout(lockTimeoutRef.current);
    }
    // Unlock after debounce + server round-trip buffer (300 + 500 = 800ms)
    lockTimeoutRef.current = setTimeout(() => {
      setIsLocalLocked(false);
      lockTimeoutRef.current = null;
    }, 800);
  };

  // Debounced server update - only sends after user stops clicking
  const debouncedServerUpdate = (quantity: number) => {
    // Lock local state immediately on user interaction
    lockLocalState();

    // Clear any existing debounce timer
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
    // Prevent duplicate remove calls when clicking rapidly
    if (isRemoving) return;
    removeItem(item.id);
  };

  // Get store slug from the cart store for links
  const { storeSlug } = useCart();

  return (
    <div className="flex gap-4 rounded-lg border p-4">
      {/* Product Image - prioritize variant image over product image */}
      <Link
        href={`/store/${storeSlug}/product/${item.product.slug}`}
        className="relative aspect-square h-24 w-24 shrink-0 overflow-hidden rounded-md bg-muted"
      >
        {item.variant?.image || item.product.image ? (
          <Image
            src={item.variant?.image?.url || item.product.image?.url || ""}
            alt={
              item.variant?.image?.altText ||
              item.product.image?.altText ||
              item.product.name
            }
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
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {hasTierDiscount || hasCampaignDiscount ? (
                <>
                  <span className="text-sm font-medium text-green-600">
                    {formatPrice(effectivePrice, currency)}
                  </span>
                  <span className="text-sm text-muted-foreground line-through">
                    {formatPrice(originalBasePrice, currency)}
                  </span>
                  <span className="text-xs text-green-600">each</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {formatPrice(effectivePrice, currency)} each
                </span>
              )}
            </div>
            {hasCampaignDiscount && (
              <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
                <Sparkles className="h-3 w-3" />
                <span>
                  {campaignDiscount?.badgeText ||
                    `${campaignDiscount?.campaignName} applied`}
                </span>
              </div>
            )}
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
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive active:scale-90 transition-transform"
            onClick={handleRemove}
            disabled={isRemoving}
            aria-label="Remove item"
          >
            <Trash2 className="h-4 w-4" />
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
