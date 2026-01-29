"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ShoppingCart,
  Minus,
  Plus,
  Trash2,
  ArrowRight,
  ShoppingBag,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import { formatPrice, cn } from "@/lib/utils";
import { useCart, useCartDrawer } from "@/lib/hooks/use-cart";
import type { CartItem } from "@/lib/types/cart";

interface CartDrawerProps {
  storeSlug: string;
  currency: string;
}

// Hook to detect if we're on mobile (< 640px)
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}

// Hook to integrate drawer with browser history for back button support
function useDrawerHistory(isOpen: boolean, onClose: () => void) {
  // Track if we pushed history for this drawer open
  const historyPushedRef = useRef(false);
  // Track if closing due to navigation (to avoid calling history.back)
  const isNavigatingRef = useRef(false);

  // Handle popstate (back button)
  const handlePopState = useCallback(() => {
    if (historyPushedRef.current) {
      historyPushedRef.current = false;
      onClose();
    }
  }, [onClose]);

  // Track navigation events to avoid calling history.back during navigation
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");
      if (link && link.href && !link.href.startsWith("javascript:")) {
        // User is navigating via a link, mark as navigating
        isNavigatingRef.current = true;
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Reset navigation flag when drawer opens
      isNavigatingRef.current = false;
      // Push history state when drawer opens
      if (!historyPushedRef.current) {
        window.history.pushState(
          { cartDrawer: true },
          "",
          window.location.href
        );
        historyPushedRef.current = true;
      }
    } else {
      // Remove history entry when drawer closes (if we pushed one)
      // But NOT if we're navigating - the navigation will handle history
      if (historyPushedRef.current && !isNavigatingRef.current) {
        historyPushedRef.current = false;
        // Go back to remove our history entry
        window.history.back();
      } else {
        historyPushedRef.current = false;
      }
    }
  }, [isOpen]);

  useEffect(() => {
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [handlePopState]);
}

export function CartDrawer({ storeSlug, currency }: CartDrawerProps) {
  const { isOpen, close } = useCartDrawer();
  const { items, subtotal, itemCount } = useCart();
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtTop, setIsAtTop] = useState(true);

  // Integrate with browser history for back button support (mobile UX)
  useDrawerHistory(isOpen, close);

  // Track scroll position to enable/disable drawer dismissal
  const handleScroll = () => {
    if (scrollRef.current) {
      const isScrolledToTop = scrollRef.current.scrollTop === 0;
      setIsAtTop(isScrolledToTop);
    }
  };

  return (
    <Drawer
      direction={isMobile ? "bottom" : "right"}
      open={isOpen}
      onOpenChange={(open) => !open && close()}
      dismissible={true}
      shouldScaleBackground={false}
    >
      <DrawerContent
        className={cn(
          isMobile ? "max-h-[96vh]" : "h-full w-full sm:max-w-md",
          "flex flex-col"
        )}
      >
        {/* Header */}
        <DrawerHeader className="shrink-0 border-b px-4 py-4">
          <div className="flex items-center justify-between">
            <DrawerTitle className="flex items-center gap-2 text-lg">
              <ShoppingBag className="size-5" />
              Your Cart
              {itemCount > 0 && (
                <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                  {itemCount}
                </span>
              )}
            </DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        {items.length === 0 ? (
          /* Empty Cart State */
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-muted">
              <ShoppingCart className="size-10 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Your cart is empty</h3>
            <p className="mb-6 max-w-60 text-sm text-muted-foreground">
              Looks like you haven&apos;t added anything to your cart yet.
            </p>
            <DrawerClose asChild>
              <Button size="lg" asChild>
                <Link href={`/store/${storeSlug}`}>Start Shopping</Link>
              </Button>
            </DrawerClose>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto overflow-x-hidden px-4"
              onScroll={handleScroll}
              {...(!isAtTop && { "data-vaul-no-drag": "" })}
            >
              <div className="py-4">
                {items.map((item, index) => (
                  <div key={item.id}>
                    <CartDrawerItem
                      item={item}
                      storeSlug={storeSlug}
                      currency={currency}
                    />
                    {index < items.length - 1 && <Separator className="my-4" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer with Summary */}
            <DrawerFooter className="shrink-0 border-t bg-muted/30 px-4 pb-6 pt-4">
              {/* Subtotal */}
              <div className="mx-auto w-full max-w-sm space-y-2 sm:mx-0 sm:max-w-none">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">
                    {formatPrice(subtotal, currency)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Shipping and taxes calculated at checkout
                </p>
              </div>

              {/* Actions */}
              <div className="mx-auto mt-4 flex w-full max-w-sm flex-col gap-2 sm:mx-0 sm:max-w-none">
                <DrawerClose asChild>
                  <Button size="lg" className="w-full" asChild>
                    <Link href={`/store/${storeSlug}/checkout`}>
                      Checkout
                      <ArrowRight className="ml-2 size-4" />
                    </Link>
                  </Button>
                </DrawerClose>
                <DrawerClose asChild>
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full"
                    asChild
                  >
                    <Link href={`/store/${storeSlug}/cart`}>
                      View Full Cart
                    </Link>
                  </Button>
                </DrawerClose>
              </div>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

interface CartDrawerItemProps {
  item: CartItem;
  storeSlug: string;
  currency: string;
}

function CartDrawerItem({ item, storeSlug, currency }: CartDrawerItemProps) {
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
  const { updateQuantity, removeItem } = useCart({ debounce: false });

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

  const price = item.variant?.price
    ? parseFloat(item.variant.price)
    : parseFloat(item.product.price);

  const lineTotal = price * localQuantity;

  const availableStock = item.variant ? item.variant.stock : item.product.stock;
  const trackInventory = item.product.trackInventory;
  const allowBackorder = item.product.allowBackorder;

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

    if (newQuantity < 1) return;

    if (trackInventory && !allowBackorder && newQuantity > availableStock) {
      toast.error("Can't add more", {
        description:
          availableStock === 0
            ? "This item is out of stock"
            : `Only ${availableStock} item${availableStock === 1 ? "" : "s"} available`,
      });
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
        toast.error("Can't add more", {
          description: `Only ${availableStock} item${availableStock === 1 ? "" : "s"} available`,
        });
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

  return (
    <div className="flex gap-4">
      {/* Product Image */}
      <Link
        href={`/store/${storeSlug}/product/${item.product.slug}`}
        className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted"
      >
        {item.product.image ? (
          <Image
            src={item.product.image.url}
            alt={item.product.image.altText || item.product.name}
            fill
            className="object-cover transition-transform hover:scale-105"
            sizes="80px"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <ShoppingBag className="size-6 text-muted-foreground" />
          </div>
        )}
      </Link>

      {/* Product Details */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Name & Remove */}
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/store/${storeSlug}/product/${item.product.slug}`}
            className="line-clamp-2 text-sm font-medium leading-tight hover:underline"
          >
            {productName}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground hover:text-destructive active:scale-90 transition-transform"
            onClick={handleRemove}
          >
            <Trash2 className="size-4" />
            <span className="sr-only">Remove</span>
          </Button>
        </div>

        {/* Price */}
        <p className="mt-1 text-sm text-muted-foreground">
          {formatPrice(price, currency)} each
        </p>

        {/* Quantity & Line Total */}
        <div className="mt-auto flex items-center justify-between pt-2">
          {/* Quantity Controls */}
          <div className="flex items-center rounded-lg border bg-background">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-r-none"
              onClick={() => handleQuantityChange(-1)}
              disabled={localQuantity <= 1}
            >
              <Minus className="size-3" />
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
              className="h-8 w-12 rounded-none border-0 border-x bg-transparent text-center text-sm font-medium focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label="Quantity"
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-l-none"
              onClick={() => handleQuantityChange(+1)}
              disabled={
                trackInventory &&
                !allowBackorder &&
                localQuantity >= availableStock
              }
            >
              <Plus className="size-3" />
            </Button>
          </div>

          {/* Line Total */}
          <span className="text-sm font-semibold">
            {formatPrice(lineTotal, currency)}
          </span>
        </div>
      </div>
    </div>
  );
}
