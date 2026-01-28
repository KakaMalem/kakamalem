"use client";

import { useState, useCallback } from "react";
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
  }>;
  image: string | null;
};

interface POSTerminalProps {
  tenantId: string;
  storeSlug: string;
  currency: string;
  categories: Category[];
  scannerMode: "camera" | "usb";
}

export function POSTerminal({
  tenantId,
  storeSlug,
  currency,
  categories,
  scannerMode,
}: POSTerminalProps) {
  const [items, setItems] = useState<POSCartItem[]>([]);
  const [discountType, setDiscountType] = useState<"amount" | "percent">(
    "percent"
  );
  const [discountValue, setDiscountValue] = useState(0);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

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
        const updated = [...items];
        updated[existingIndex].quantity += 1;
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
            image: product.image,
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

  // Handle successful sale
  const handleSaleSuccess = useCallback(() => {
    setItems([]);
    setDiscountValue(0);
    setMobileCartOpen(false);
    // Stock is updated via Zustand store in POSPaymentModal
  }, []);

  // Height: viewport - header(4rem) - vertical padding (2rem mobile, 3rem desktop)
  return (
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
        />

        {/* Checkout button - Desktop */}
        <div className="shrink-0 border-t p-4">
          <Button
            onClick={() => setPaymentModalOpen(true)}
            disabled={items.length === 0}
            className="w-full h-14 text-lg"
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
      />
    </div>
  );
}
