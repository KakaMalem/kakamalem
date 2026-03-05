"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { ShoppingCart, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatPrice } from "@/lib/utils";
import { POSProductGrid } from "./pos-product-grid";
import { POSCart, calculateCartTotals, type POSCartItem } from "./pos-cart";
import { POSPaymentModal } from "./pos-payment-modal";
import { PrinterConnectionButton } from "./printer-connection-button";
import { ConnectivityIndicator } from "./connectivity-indicator";
import { InstallPrompt } from "./install-prompt";
import { POSOfflineProvider } from "./pos-offline-provider";
import { OFFLINE_POS_ENABLED } from "@/lib/offline/feature-flag";
import type { ReceiptPrintMode } from "@/lib/validations/stores";

// Hook to integrate sheet with browser history for back button support
function useSheetHistory(isOpen: boolean, onClose: () => void) {
  const historyPushedRef = useRef(false);

  const handlePopState = useCallback(() => {
    if (historyPushedRef.current) {
      historyPushedRef.current = false;
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      if (!historyPushedRef.current) {
        window.history.pushState(
          { posCartSheet: true },
          "",
          window.location.href
        );
        historyPushedRef.current = true;
      }
    } else {
      if (historyPushedRef.current) {
        historyPushedRef.current = false;
        window.history.back();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [handlePopState]);
}

type Category = {
  id: string;
  name: string;
  imageUrl: string | null;
};

type SearchProduct = {
  id: string;
  name: string;
  price: string;
  stock: number;
  trackInventory: boolean;
  hasVariants: boolean;
  variants: Array<{
    id: string;
    displayName: string;
    sku: string | null;
    barcode: string | null;
    price: string | null;
    stock: number;
    image: string | null;
  }>;
  image: string | null;
};

interface POSTerminalProps {
  tenantId: string;
  storeSlug: string;
  currency: string;
  categories: Category[];
  scannerMode: "camera" | "usb";
  // Receipt printing settings
  receiptPrintMode: ReceiptPrintMode;
  storeName: string;
  storePhone: string | null;
  receiptFooterText: string | null;
  receiptPaperWidth: "58mm" | "80mm";
}

export function POSTerminal({
  tenantId,
  storeSlug,
  currency,
  categories,
  scannerMode,
  receiptPrintMode,
  storeName,
  storePhone,
  receiptFooterText,
  receiptPaperWidth,
}: POSTerminalProps) {
  const [items, setItems] = useState<POSCartItem[]>([]);
  const [discountType, setDiscountType] = useState<"amount" | "percent">(
    "percent"
  );
  const [discountValue, setDiscountValue] = useState(0);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Integrate mobile cart sheet with browser history for back button support
  useSheetHistory(mobileCartOpen, () => setMobileCartOpen(false));

  // Calculate totals
  const { total, totalDiscount, itemCount } = calculateCartTotals(
    items,
    discountType,
    discountValue
  );

  // Add product to cart
  const handleProductSelect = useCallback(
    (product: SearchProduct, variant?: SearchProduct["variants"][0]) => {
      const productId = product.id;
      const variantId = variant?.id || null;
      const price = variant?.price
        ? parseFloat(variant.price)
        : parseFloat(product.price);
      const stock = variant ? variant.stock : product.stock;
      const itemId = `${productId}-${variantId || "base"}`;

      // Check if already in cart
      const existingIndex = items.findIndex((item) => item.id === itemId);

      if (existingIndex >= 0) {
        const currentQty = items[existingIndex].quantity;
        if (product.trackInventory && currentQty >= stock) {
          toast.error("Not enough stock");
          return;
        }
        // Remove from current position and add to end (appears on top when reversed)
        const updated = [...items];
        const [existingItem] = updated.splice(existingIndex, 1);
        existingItem.quantity += 1;
        updated.push(existingItem);
        setItems(updated);
      } else {
        setItems([
          ...items,
          {
            id: itemId,
            productId,
            variantId,
            productName: product.name,
            variantName: variant?.displayName || null,
            sku: variant?.sku || null,
            price,
            originalPrice: price,
            quantity: 1,
            trackInventory: product.trackInventory,
            // Prioritize variant image over product image
            image: variant?.image || product.image,
            maxStock: stock,
          },
        ]);
      }
    },
    [items]
  );

  // Update quantity
  const handleUpdateQuantity = useCallback(
    (id: string, delta: number) => {
      const index = items.findIndex((item) => item.id === id);
      if (index < 0) return;

      const updated = [...items];
      const item = updated[index];
      const newQty = item.quantity + delta;

      if (newQty <= 0) {
        updated.splice(index, 1);
      } else if (item.trackInventory && newQty > item.maxStock) {
        toast.error("Not enough stock");
        return;
      } else {
        item.quantity = newQty;
      }

      setItems(updated);
    },
    [items]
  );

  // Set quantity directly
  const handleSetQuantity = useCallback(
    (id: string, quantity: number) => {
      const index = items.findIndex((item) => item.id === id);
      if (index < 0) return;

      const updated = [...items];
      const item = updated[index];

      if (quantity < 0) quantity = 0;
      if (item.trackInventory && quantity > item.maxStock) {
        quantity = item.maxStock;
      }

      item.quantity = quantity;
      setItems(updated);
    },
    [items]
  );

  // Remove item
  const handleRemoveItem = useCallback(
    (id: string) => {
      setItems(items.filter((item) => item.id !== id));
    },
    [items]
  );

  // Clear cart
  const handleClearCart = useCallback(() => {
    setItems([]);
    setDiscountValue(0);
  }, []);

  // Set individual item custom price
  const handleUpdateItemPrice = useCallback((id: string, newPrice: number) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === id ? { ...item, price: newPrice } : item
      )
    );
  }, []);

  // Handle successful sale
  const handleSaleSuccess = useCallback(() => {
    setItems([]);
    setDiscountValue(0);
    setMobileCartOpen(false);
    // Stock is updated via Zustand store in POSPaymentModal
  }, []);

  // Height: viewport - header(4rem) - vertical padding (2rem mobile, 3rem desktop)
  const content = (
    <>
      {/* Offline POS Features */}
      {OFFLINE_POS_ENABLED && (
        <>
          <InstallPrompt />
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50">
            <ConnectivityIndicator />
          </div>
        </>
      )}

      <div className="h-[calc(100dvh-6rem)] md:h-[calc(100dvh-7rem)] flex flex-col lg:flex-row border overflow-hidden">
        {/* Product Grid - Full width on mobile, 2/3 on desktop */}
        <div className="flex flex-1 min-h-0 flex-col lg:border-r">
          <POSProductGrid
            tenantId={tenantId}
            currency={currency}
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              image: c.imageUrl,
            }))}
            onProductSelect={handleProductSelect}
            scannerMode={scannerMode}
          />
        </div>

        {/* Cart Sidebar - Hidden on mobile, shown on desktop */}
        <div className="hidden lg:flex lg:w-96 xl:w-105 shrink-0 flex-col min-h-0">
          <POSCart
            items={items}
            currency={currency}
            discountType={discountType}
            discountValue={discountValue}
            onUpdateQuantity={handleUpdateQuantity}
            onSetQuantity={handleSetQuantity}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
            onDiscountTypeChange={setDiscountType}
            onDiscountValueChange={setDiscountValue}
            onUpdateItemPrice={handleUpdateItemPrice}
          />

          {/* Checkout button - Desktop */}
          <div className="shrink-0 border-t p-4">
            <div className="flex gap-2">
              {receiptPrintMode === "silent" && <PrinterConnectionButton />}
              <Button
                onClick={() => setPaymentModalOpen(true)}
                disabled={items.length === 0}
                className="flex-1 h-14 text-lg"
                size="lg"
              >
                <Receipt className="mr-2 size-5" />
                Checkout
                {total > 0 && (
                  <span className="ml-2 opacity-80">
                    • {formatPrice(total, currency)}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Bottom Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background p-4 lg:hidden safe-area-bottom">
          <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
            <SheetTrigger asChild>
              <Button
                className="w-full h-14 text-base"
                size="lg"
                disabled={items.length === 0}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="size-5" />
                    <span>View Cart</span>
                    {itemCount > 0 && (
                      <Badge
                        variant="secondary"
                        className="bg-white/20 text-white"
                      >
                        {itemCount}
                      </Badge>
                    )}
                  </div>
                  <span className="font-bold">
                    {formatPrice(total, currency)}
                  </span>
                </div>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] rounded-t-xl p-0">
              <SheetHeader className="border-b px-4 py-3">
                <SheetTitle>Cart</SheetTitle>
              </SheetHeader>
              <div className="flex h-[calc(85vh-60px)] flex-col">
                <div className="flex-1 overflow-auto">
                  <POSCart
                    items={items}
                    currency={currency}
                    discountType={discountType}
                    discountValue={discountValue}
                    onUpdateQuantity={handleUpdateQuantity}
                    onSetQuantity={handleSetQuantity}
                    onRemoveItem={handleRemoveItem}
                    onClearCart={handleClearCart}
                    onDiscountTypeChange={setDiscountType}
                    onDiscountValueChange={setDiscountValue}
                    onUpdateItemPrice={handleUpdateItemPrice}
                  />
                </div>
                <div className="border-t p-4 bg-background">
                  <Button
                    onClick={() => {
                      setMobileCartOpen(false);
                      setPaymentModalOpen(true);
                    }}
                    disabled={items.length === 0}
                    className="w-full h-14 text-lg"
                    size="lg"
                  >
                    <Receipt className="mr-2 size-5" />
                    Checkout • {formatPrice(total, currency)}
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Payment Modal */}
        <POSPaymentModal
          open={paymentModalOpen}
          onOpenChange={setPaymentModalOpen}
          items={items}
          total={total}
          discountAmount={totalDiscount}
          tenantId={tenantId}
          storeSlug={storeSlug}
          currency={currency}
          onSuccess={handleSaleSuccess}
          receiptPrintMode={receiptPrintMode}
          storeName={storeName}
          storePhone={storePhone}
          receiptFooterText={receiptFooterText}
          receiptPaperWidth={receiptPaperWidth}
        />
      </div>
    </>
  );

  // Wrap with offline provider when feature is enabled
  if (OFFLINE_POS_ENABLED) {
    return (
      <POSOfflineProvider tenantId={tenantId} storeSlug={storeSlug}>
        {content}
      </POSOfflineProvider>
    );
  }

  return content;
}
