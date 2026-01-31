"use client";

import { useState, useCallback, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Receipt,
  Loader2,
  Banknote,
  CreditCard,
  Smartphone,
  Building2,
  Clock,
  ShoppingCart,
  ChevronUp,
  User,
  Package,
  Percent,
  Tag,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn, formatPrice } from "@/lib/utils";

import {
  recordOfflineSale,
  searchProductsForSale,
} from "@/lib/actions/offline-sales";
import type {
  OfflineSaleItem,
  PaymentMethod,
} from "@/lib/validations/offline-sales";

interface RecordSaleFormProps {
  storeSlug: string;
  tenantId: string;
  currency: string;
}

type CartItem = OfflineSaleItem & {
  image?: string | null;
  maxStock: number;
  originalPrice: number;
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
    price: string | null;
    stock: number;
  }>;
  image: string | null;
};

const PAYMENT_METHODS: Array<{
  value: PaymentMethod;
  label: string;
  icon: typeof Banknote;
}> = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "mobile_money", label: "Mobile", icon: Smartphone },
  { value: "bank_transfer", label: "Transfer", icon: Building2 },
];

export function RecordSaleForm({
  storeSlug,
  tenantId,
  currency,
}: RecordSaleFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountReceived, setAmountReceived] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [staffNotes, setStaffNotes] = useState("");

  // Cart state
  const [items, setItems] = useState<CartItem[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Mobile checkout sheet
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Customer section collapsed state
  const [customerExpanded, setCustomerExpanded] = useState(false);

  // Discount state
  const [discountType, setDiscountType] = useState<"amount" | "percent">(
    "percent"
  );
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountExpanded, setDiscountExpanded] = useState(false);

  // Quick discount presets
  const DISCOUNT_PRESETS = [5, 10, 15, 20];

  // Calculate totals
  const subtotal = items.reduce(
    (sum, item) => sum + item.originalPrice * item.quantity,
    0
  );
  const itemLevelDiscount = items.reduce(
    (sum, item) => sum + (item.originalPrice - item.price) * item.quantity,
    0
  );

  // Calculate manual discount (either percentage or fixed amount)
  const manualDiscount =
    discountType === "percent"
      ? Math.round(
          (subtotal - itemLevelDiscount) * (discountValue / 100) * 100
        ) / 100
      : Math.min(discountValue, subtotal - itemLevelDiscount); // Can't discount more than subtotal

  const discountAmount = itemLevelDiscount + manualDiscount;
  const total = Math.max(0, subtotal - discountAmount);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Calculate effective amount paid (null = full amount)
  const effectiveAmountPaid = amountReceived === null ? total : amountReceived;
  const remainingBalance = Math.max(0, total - effectiveAmountPaid);

  // Derive payment status
  const isFullPayment = effectiveAmountPaid >= total - 0.01;
  const _isPartialPayment =
    effectiveAmountPaid > 0 && effectiveAmountPaid < total - 0.01;
  void _isPartialPayment; // Reserved for future use
  const isPayLater = effectiveAmountPaid === 0;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search on / key
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const activeElement = document.activeElement;
        if (
          activeElement?.tagName !== "INPUT" &&
          activeElement?.tagName !== "TEXTAREA"
        ) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
      // Close search on Escape
      if (e.key === "Escape") {
        setShowResults(false);
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Search products
  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);

      if (query.length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      setShowResults(true);

      const result = await searchProductsForSale(tenantId, query);

      if (result.success && result.products) {
        setSearchResults(result.products);
      } else {
        setSearchResults([]);
      }

      setIsSearching(false);
    },
    [tenantId]
  );

  // Add product to cart
  const addProduct = useCallback(
    (product: SearchProduct, variant?: SearchProduct["variants"][0]) => {
      const productId = product.id;
      const variantId = variant?.id;
      const price = variant?.price
        ? parseFloat(variant.price)
        : parseFloat(product.price);
      const stock = variant ? variant.stock : product.stock;
      const name = product.name;
      const variantName = variant?.displayName || null;
      const sku = variant?.sku || null;

      // Check if already in cart
      const existingIndex = items.findIndex(
        (item) => item.productId === productId && item.variantId === variantId
      );

      if (existingIndex >= 0) {
        const updated = [...items];
        const currentQty = updated[existingIndex].quantity;
        if (product.trackInventory && currentQty >= stock) {
          toast.error("Not enough stock");
          return;
        }
        updated[existingIndex].quantity += 1;
        setItems(updated);
      } else {
        setItems([
          ...items,
          {
            productId,
            variantId: variantId || null,
            productName: name,
            variantName,
            sku,
            price,
            originalPrice: price,
            quantity: 1,
            trackInventory: product.trackInventory,
            image: product.image,
            maxStock: stock,
          },
        ]);
      }

      // Clear search
      setSearchQuery("");
      setSearchResults([]);
      setShowResults(false);
    },
    [items]
  );

  // Update item quantity
  const updateQuantity = useCallback(
    (index: number, delta: number) => {
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

  // Set item quantity directly (allows 0 for typing, validated on blur)
  const setQuantity = useCallback(
    (index: number, newQty: number) => {
      const updated = [...items];
      const item = updated[index];

      // Allow 0 temporarily for typing UX, validated on blur
      if (newQty < 0) {
        newQty = 0;
      } else if (item.trackInventory && newQty > item.maxStock) {
        newQty = item.maxStock;
      }

      item.quantity = newQty;
      setItems(updated);
    },
    [items]
  );

  // Set item price (reserved for future price adjustment feature)
  const _setItemPrice = useCallback(
    (index: number, newPrice: number) => {
      const updated = [...items];
      const item = updated[index];

      if (newPrice < 0) {
        newPrice = 0;
      } else if (newPrice > item.originalPrice) {
        newPrice = item.originalPrice;
      }

      item.price = newPrice;
      setItems(updated);
    },
    [items]
  );
  void _setItemPrice; // Reserved for future use

  // Remove item (reserved for future direct removal feature)
  const _removeItem = useCallback(
    (index: number) => {
      const updated = [...items];
      updated.splice(index, 1);
      setItems(updated);
    },
    [items]
  );
  void _removeItem; // Reserved for future use

  // Submit form
  const handleSubmit = async () => {
    if (items.length === 0) {
      toast.error("Add at least one item");
      return;
    }

    if (effectiveAmountPaid > 0 && !paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }

    startTransition(async () => {
      const result = await recordOfflineSale(tenantId, storeSlug, {
        amountPaid: effectiveAmountPaid,
        paymentMethod: effectiveAmountPaid > 0 ? paymentMethod : null,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          variantName: item.variantName,
          sku: item.sku,
          price: item.price,
          quantity: item.quantity,
          trackInventory: item.trackInventory,
        })),
        discountAmount,
        staffNotes: staffNotes || undefined,
      });

      if (result.success && result.order) {
        toast.success("Sale completed!");
        router.push(`/dashboard/${storeSlug}/orders/${result.order.id}`);
      } else {
        toast.error(result.error?.message || "Could not complete sale");
      }
    });
  };

  // Payment section (shared between desktop and mobile) - using render function pattern

  const renderPaymentSection = (_compact = false) => (
    <div className="space-y-4">
      {/* Payment Method */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Payment Method</Label>
        <div className="grid grid-cols-4 gap-2">
          {PAYMENT_METHODS.map((method) => {
            const Icon = method.icon;
            const isSelected = paymentMethod === method.value;
            return (
              <button
                key={method.value}
                type="button"
                onClick={() => setPaymentMethod(method.value)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 rounded-lg border p-3 transition-colors min-h-16",
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "hover:bg-muted active:bg-muted/80"
                )}
              >
                <Icon className={cn("size-6", isSelected && "text-primary")} />
                <span className="text-xs font-medium">{method.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Amount Received */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Amount Received</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={amountReceived === null ? "default" : "outline"}
            className="flex-1 h-11"
            onClick={() => setAmountReceived(null)}
          >
            Full
          </Button>
          <Button
            type="button"
            variant={isPayLater ? "default" : "outline"}
            className="flex-1 h-11"
            onClick={() => setAmountReceived(0)}
          >
            <Clock className="mr-1.5 size-4" />
            Later
          </Button>
        </div>
        {!isFullPayment && !isPayLater && (
          <div className="relative">
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max={total}
              value={amountReceived ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") {
                  setAmountReceived(null);
                } else {
                  const num = parseFloat(val);
                  setAmountReceived(isNaN(num) ? null : num);
                }
              }}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="Custom amount"
              className="pr-14 h-11 text-base"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {currency}
            </span>
          </div>
        )}
      </div>

      {/* Balance indicator */}
      {remainingBalance > 0 && !isPayLater && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm">
          <div className="flex items-center justify-between text-amber-800">
            <span>Balance due</span>
            <span className="font-semibold">
              {formatPrice(remainingBalance, currency)}
            </span>
          </div>
        </div>
      )}

      {isPayLater && (
        <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="size-4" />
            <span>Order will be saved as unpaid</span>
          </div>
        </div>
      )}
    </div>
  );

  // Cart item row (compact version for better mobile UX) - using render function pattern
  const renderCartItemRow = (item: CartItem, index: number) => (
    <div className="flex items-center gap-3 py-3 border-b last:border-0">
      {/* Product image */}
      <div className="size-12 rounded-lg bg-muted overflow-hidden shrink-0">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.productName}
            width={48}
            height={48}
            className="size-full object-cover"
          />
        ) : (
          <div className="size-full flex items-center justify-center">
            <Package className="size-5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Product info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{item.productName}</div>
        {item.variantName && (
          <div className="text-xs text-muted-foreground truncate">
            {item.variantName}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-medium">
            {formatPrice(item.price, currency)}
          </span>
          {item.price < item.originalPrice && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(item.originalPrice, currency)}
            </span>
          )}
        </div>
      </div>

      {/* Quantity controls - minimum 40px touch targets */}
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10"
          onClick={() => updateQuantity(index, -1)}
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
            // Allow empty string or valid numbers for better typing UX
            if (val === "" || /^\d+$/.test(val)) {
              const num = val === "" ? 0 : parseInt(val);
              setQuantity(index, num);
            }
          }}
          onBlur={(e) => {
            const val = parseInt(e.target.value);
            if (isNaN(val) || val < 1) {
              setQuantity(index, 1);
            }
          }}
          className="h-10 w-14 text-center px-1 text-base font-medium"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10"
          onClick={() => updateQuantity(index, 1)}
          disabled={item.trackInventory && item.quantity >= item.maxStock}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="relative pb-20 lg:pb-0">
      {/* Main layout */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: Search & Cart */}
        <div className="space-y-4 lg:col-span-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search products... (press / to focus)"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
              className="pl-10 h-12 text-base"
            />

            {/* Search results */}
            {showResults && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[60vh] overflow-auto rounded-lg border bg-popover shadow-lg">
                {isSearching ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Package className="mx-auto mb-2 size-8" />
                    <p>No products found</p>
                  </div>
                ) : (
                  searchResults.map((product) => (
                    <div key={product.id}>
                      {product.hasVariants && product.variants.length > 0 ? (
                        <>
                          <div className="flex items-center gap-3 bg-muted/50 px-4 py-2">
                            {product.image && (
                              <Image
                                src={product.image}
                                alt={product.name}
                                width={32}
                                height={32}
                                className="size-8 rounded object-cover"
                              />
                            )}
                            <span className="font-medium text-sm">
                              {product.name}
                            </span>
                          </div>
                          {product.variants.map((variant) => {
                            const isOutOfStock =
                              product.trackInventory && variant.stock <= 0;
                            return (
                              <button
                                key={variant.id}
                                type="button"
                                className={cn(
                                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                                  isOutOfStock
                                    ? "cursor-not-allowed opacity-50"
                                    : "hover:bg-muted active:bg-muted/80"
                                )}
                                onClick={() =>
                                  !isOutOfStock && addProduct(product, variant)
                                }
                                disabled={isOutOfStock}
                              >
                                <div className="flex-1 pl-11">
                                  <div className="text-sm">
                                    {variant.displayName}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium">
                                    {formatPrice(
                                      parseFloat(
                                        variant.price || product.price
                                      ),
                                      currency
                                    )}
                                  </div>
                                  {product.trackInventory && (
                                    <div
                                      className={cn(
                                        "text-xs",
                                        isOutOfStock
                                          ? "text-destructive font-medium"
                                          : "text-muted-foreground"
                                      )}
                                    >
                                      {isOutOfStock
                                        ? "Out of stock"
                                        : `${variant.stock} in stock`}
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </>
                      ) : (
                        (() => {
                          const isOutOfStock =
                            product.trackInventory && product.stock <= 0;
                          return (
                            <button
                              type="button"
                              className={cn(
                                "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                                isOutOfStock
                                  ? "cursor-not-allowed opacity-50"
                                  : "hover:bg-muted active:bg-muted/80"
                              )}
                              onClick={() =>
                                !isOutOfStock && addProduct(product)
                              }
                              disabled={isOutOfStock}
                            >
                              <div className="size-10 rounded-lg bg-muted overflow-hidden shrink-0">
                                {product.image ? (
                                  <Image
                                    src={product.image}
                                    alt={product.name}
                                    width={40}
                                    height={40}
                                    className="size-full object-cover"
                                  />
                                ) : (
                                  <div className="size-full flex items-center justify-center">
                                    <Package className="size-4 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium">
                                  {product.name}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium">
                                  {formatPrice(
                                    parseFloat(product.price),
                                    currency
                                  )}
                                </div>
                                {product.trackInventory && (
                                  <div
                                    className={cn(
                                      "text-xs",
                                      isOutOfStock
                                        ? "text-destructive font-medium"
                                        : "text-muted-foreground"
                                    )}
                                  >
                                    {isOutOfStock
                                      ? "Out of stock"
                                      : `${product.stock} in stock`}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })()
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="rounded-xl border bg-card">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold flex items-center gap-2">
                <ShoppingCart className="size-4" />
                Cart
                {itemCount > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {itemCount}
                  </Badge>
                )}
              </h2>
              {items.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setItems([])}
                >
                  Clear
                </Button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <ShoppingCart className="mx-auto mb-3 size-10 opacity-50" />
                <p className="font-medium">Cart is empty</p>
                <p className="text-sm">Search for products to add</p>
              </div>
            ) : (
              <div className="px-4">
                {items.map((item, index) => (
                  <div key={`${item.productId}-${item.variantId || "base"}`}>
                    {renderCartItemRow(item, index)}
                  </div>
                ))}
              </div>
            )}

            {/* Cart summary */}
            {items.length > 0 && (
              <div className="p-4 border-t bg-muted/30">
                {/* Discount Section */}
                <Collapsible
                  open={discountExpanded}
                  onOpenChange={setDiscountExpanded}
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between py-2 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors">
                    <div className="flex items-center gap-2">
                      <Tag className="size-4 text-green-600" />
                      <span className="font-medium text-sm">Add Discount</span>
                      {manualDiscount > 0 && (
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-700"
                        >
                          -
                          {discountType === "percent"
                            ? `${discountValue}%`
                            : formatPrice(discountValue, currency)}
                        </Badge>
                      )}
                    </div>
                    <ChevronUp
                      className={cn(
                        "size-4 transition-transform",
                        !discountExpanded && "rotate-180"
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="pt-3 pb-2 space-y-3">
                      {/* Discount Type Toggle */}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={
                            discountType === "percent" ? "default" : "outline"
                          }
                          size="sm"
                          className="flex-1 h-10"
                          onClick={() => {
                            setDiscountType("percent");
                            setDiscountValue(0);
                          }}
                        >
                          <Percent className="mr-1.5 size-4" />
                          Percentage
                        </Button>
                        <Button
                          type="button"
                          variant={
                            discountType === "amount" ? "default" : "outline"
                          }
                          size="sm"
                          className="flex-1 h-10"
                          onClick={() => {
                            setDiscountType("amount");
                            setDiscountValue(0);
                          }}
                        >
                          <Tag className="mr-1.5 size-4" />
                          Fixed Amount
                        </Button>
                      </div>

                      {/* Quick Discount Buttons (Percentage mode only) */}
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
                                setDiscountValue(
                                  discountValue === preset ? 0 : preset
                                )
                              }
                            >
                              {preset}%
                            </Button>
                          ))}
                        </div>
                      )}

                      {/* Custom Discount Input */}
                      <div className="relative">
                        <Input
                          type="number"
                          step={discountType === "percent" ? "1" : "0.01"}
                          min="0"
                          max={
                            discountType === "percent"
                              ? 100
                              : subtotal - itemLevelDiscount
                          }
                          value={discountValue || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (isNaN(val) || val < 0) {
                              setDiscountValue(0);
                            } else if (
                              discountType === "percent" &&
                              val > 100
                            ) {
                              setDiscountValue(100);
                            } else {
                              setDiscountValue(val);
                            }
                          }}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder={
                            discountType === "percent"
                              ? "Custom %"
                              : "Custom amount"
                          }
                          className="pr-12 h-10"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          {discountType === "percent" ? "%" : currency}
                        </span>
                      </div>

                      {/* Clear Discount Button */}
                      {discountValue > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full text-muted-foreground"
                          onClick={() => setDiscountValue(0)}
                        >
                          Clear Discount
                        </Button>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator className="my-3" />

                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatPrice(subtotal, currency)}</span>
                  </div>
                  {itemLevelDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Item discounts</span>
                      <span>-{formatPrice(itemLevelDiscount, currency)}</span>
                    </div>
                  )}
                  {manualDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>
                        Discount (
                        {discountType === "percent"
                          ? `${discountValue}%`
                          : "fixed"}
                        )
                      </span>
                      <span>-{formatPrice(manualDiscount, currency)}</span>
                    </div>
                  )}
                </div>
                <Separator className="my-3" />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatPrice(total, currency)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar (desktop only) */}
        <div className="hidden lg:block lg:col-span-2 space-y-4">
          {/* Payment */}
          <div className="rounded-xl border bg-card p-4">
            <Label className="text-sm font-medium mb-3 block">Payment</Label>
            {renderPaymentSection()}
          </div>

          {/* Customer (collapsible) */}
          <Collapsible
            open={customerExpanded}
            onOpenChange={setCustomerExpanded}
          >
            <div className="rounded-xl border bg-card overflow-hidden">
              <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <User className="size-4" />
                  <span className="font-medium text-sm">Customer Info</span>
                  {(customerName || customerPhone) && (
                    <Badge variant="secondary" className="text-xs">
                      {customerName || customerPhone}
                    </Badge>
                  )}
                </div>
                <ChevronUp
                  className={cn(
                    "size-4 transition-transform",
                    !customerExpanded && "rotate-180"
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-3">
                  <Input
                    placeholder="Customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                  <Input
                    placeholder="Phone number"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                  <Textarea
                    placeholder="Notes..."
                    value={staffNotes}
                    onChange={(e) => setStaffNotes(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Complete Sale Button */}
          <Button
            onClick={handleSubmit}
            disabled={isPending || items.length === 0}
            className="w-full h-14 text-lg"
            size="lg"
          >
            {isPending ? (
              <Loader2 className="mr-2 size-5 animate-spin" />
            ) : (
              <Receipt className="mr-2 size-5" />
            )}
            Complete Sale
            {total > 0 && (
              <span className="ml-2 opacity-80">
                • {formatPrice(total, currency)}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background p-4 lg:hidden safe-area-bottom">
        <Sheet open={checkoutOpen} onOpenChange={setCheckoutOpen}>
          <SheetTrigger asChild>
            <Button
              className="w-full h-14 text-base"
              size="lg"
              disabled={items.length === 0}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="size-5" />
                  <span>Checkout</span>
                  {itemCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="bg-primary-foreground/20"
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
          <SheetContent side="bottom" className="h-[85vh] rounded-t-xl">
            <SheetHeader className="text-left pb-4">
              <SheetTitle>Complete Sale</SheetTitle>
            </SheetHeader>

            <div className="space-y-6 overflow-auto max-h-[calc(85vh-140px)]">
              {/* Payment */}
              {renderPaymentSection(true)}

              {/* Customer */}
              <Collapsible
                open={customerExpanded}
                onOpenChange={setCustomerExpanded}
              >
                <CollapsibleTrigger className="flex w-full items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <User className="size-4" />
                    <span className="font-medium text-sm">
                      Customer Info (optional)
                    </span>
                  </div>
                  <ChevronUp
                    className={cn(
                      "size-4 transition-transform",
                      !customerExpanded && "rotate-180"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-3 pt-2">
                    <Input
                      placeholder="Customer name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                    <Input
                      placeholder="Phone number"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                    <Textarea
                      placeholder="Notes..."
                      value={staffNotes}
                      onChange={(e) => setStaffNotes(e.target.value)}
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Discount Section (Mobile) */}
              <Collapsible
                open={discountExpanded}
                onOpenChange={setDiscountExpanded}
              >
                <CollapsibleTrigger className="flex w-full items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Tag className="size-4 text-green-600" />
                    <span className="font-medium text-sm">Add Discount</span>
                    {manualDiscount > 0 && (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-700"
                      >
                        -
                        {discountType === "percent"
                          ? `${discountValue}%`
                          : formatPrice(discountValue, currency)}
                      </Badge>
                    )}
                  </div>
                  <ChevronUp
                    className={cn(
                      "size-4 transition-transform",
                      !discountExpanded && "rotate-180"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pt-3 pb-2 space-y-3">
                    {/* Discount Type Toggle */}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={
                          discountType === "percent" ? "default" : "outline"
                        }
                        size="sm"
                        className="flex-1 h-12"
                        onClick={() => {
                          setDiscountType("percent");
                          setDiscountValue(0);
                        }}
                      >
                        <Percent className="mr-1.5 size-4" />
                        Percentage
                      </Button>
                      <Button
                        type="button"
                        variant={
                          discountType === "amount" ? "default" : "outline"
                        }
                        size="sm"
                        className="flex-1 h-12"
                        onClick={() => {
                          setDiscountType("amount");
                          setDiscountValue(0);
                        }}
                      >
                        <Tag className="mr-1.5 size-4" />
                        Fixed
                      </Button>
                    </div>

                    {/* Quick Discount Buttons */}
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
                            className="h-12"
                            onClick={() =>
                              setDiscountValue(
                                discountValue === preset ? 0 : preset
                              )
                            }
                          >
                            {preset}%
                          </Button>
                        ))}
                      </div>
                    )}

                    {/* Custom Discount Input */}
                    <div className="relative">
                      <Input
                        type="number"
                        inputMode="decimal"
                        step={discountType === "percent" ? "1" : "0.01"}
                        min="0"
                        max={
                          discountType === "percent"
                            ? 100
                            : subtotal - itemLevelDiscount
                        }
                        value={discountValue || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (isNaN(val) || val < 0) {
                            setDiscountValue(0);
                          } else if (discountType === "percent" && val > 100) {
                            setDiscountValue(100);
                          } else {
                            setDiscountValue(val);
                          }
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder={
                          discountType === "percent"
                            ? "Custom %"
                            : "Custom amount"
                        }
                        className="pr-12 h-12"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        {discountType === "percent" ? "%" : currency}
                      </span>
                    </div>

                    {discountValue > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full text-muted-foreground"
                        onClick={() => setDiscountValue(0)}
                      >
                        Clear Discount
                      </Button>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Order Summary */}
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Items ({itemCount})
                    </span>
                    <span>{formatPrice(subtotal, currency)}</span>
                  </div>
                  {itemLevelDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Item discounts</span>
                      <span>-{formatPrice(itemLevelDiscount, currency)}</span>
                    </div>
                  )}
                  {manualDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>
                        Discount (
                        {discountType === "percent"
                          ? `${discountValue}%`
                          : "fixed"}
                        )
                      </span>
                      <span>-{formatPrice(manualDiscount, currency)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span>{formatPrice(total, currency)}</span>
                  </div>
                  {!isFullPayment && !isPayLater && (
                    <>
                      <div className="flex justify-between text-green-600">
                        <span>Receiving</span>
                        <span>
                          {formatPrice(effectiveAmountPaid, currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-amber-600">
                        <span>Balance due</span>
                        <span>{formatPrice(remainingBalance, currency)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Complete button */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t safe-area-bottom">
              <Button
                onClick={handleSubmit}
                disabled={isPending || items.length === 0}
                className="w-full h-14 text-lg"
                size="lg"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 size-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Receipt className="mr-2 size-5" />
                    Complete Sale • {formatPrice(total, currency)}
                  </>
                )}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
