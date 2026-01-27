"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import {
  Banknote,
  CreditCard,
  Smartphone,
  Building2,
  Clock,
  Loader2,
  Receipt,
  User,
  ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn, formatPrice } from "@/lib/utils";
import { recordOfflineSale } from "@/lib/actions/offline-sales";
import { usePOSProductsStore } from "@/lib/stores/use-pos-products-store";
import type { PaymentMethod } from "@/lib/validations/offline-sales";
import type { POSCartItem } from "./pos-cart";

interface POSPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: POSCartItem[];
  total: number;
  discountAmount: number;
  tenantId: string;
  storeSlug: string;
  currency: string;
  onSuccess: () => void;
}

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

export function POSPaymentModal({
  open,
  onOpenChange,
  items,
  total,
  discountAmount,
  tenantId,
  storeSlug,
  currency,
  onSuccess,
}: POSPaymentModalProps) {
  const [isPending, startTransition] = useTransition();
  const updateStock = usePOSProductsStore((state) => state.updateStock);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [isFullPayment, setIsFullPayment] = useState(true);
  const [customAmount, setCustomAmount] = useState("");
  const [isPayLater, setIsPayLater] = useState(false);
  const [customerExpanded, setCustomerExpanded] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [staffNotes, setStaffNotes] = useState("");

  const amountReceived = isPayLater
    ? 0
    : isFullPayment
      ? total
      : parseFloat(customAmount) || 0;
  const canComplete = isPayLater || amountReceived > 0;

  // Reset form state when modal opens
  // Using requestAnimationFrame to schedule resets asynchronously
  // to avoid cascading render issues with the React Compiler
  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => {
        setIsFullPayment(true);
        setCustomAmount("");
        setIsPayLater(false);
        setPaymentMethod("cash");
        setCustomerName("");
        setCustomerPhone("");
        setStaffNotes("");
        setCustomerExpanded(false);
      });
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    const effectiveAmount = amountReceived;

    startTransition(async () => {
      const result = await recordOfflineSale(tenantId, storeSlug, {
        amountPaid: effectiveAmount,
        paymentMethod: effectiveAmount > 0 ? paymentMethod : null,
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
        // Update stock in the store immediately (no need to refetch)
        if (result.updatedStock && result.updatedStock.length > 0) {
          updateStock(result.updatedStock);
        }

        toast.success(
          `Sale completed! Receipt: ${result.order.receiptNumber}`,
          {
            duration: 8000,
            action: {
              label: "Print Receipt",
              onClick: () => {
                // Use hidden iframe to print directly without opening new window
                const printUrl = `/dashboard/${storeSlug}/orders/${result.order!.id}/print`;
                const iframe = document.createElement("iframe");
                iframe.style.position = "fixed";
                iframe.style.right = "0";
                iframe.style.bottom = "0";
                iframe.style.width = "0";
                iframe.style.height = "0";
                iframe.style.border = "none";
                iframe.src = printUrl;

                iframe.onload = () => {
                  // Wait for CSS to be fully applied before printing
                  setTimeout(() => {
                    iframe.contentWindow?.print();
                    // Remove iframe after print dialog closes
                    setTimeout(() => {
                      document.body.removeChild(iframe);
                    }, 1000);
                  }, 500);
                };

                document.body.appendChild(iframe);
              },
            },
          }
        );
        onOpenChange(false);
        onSuccess();
        // Don't redirect - keep POS flow fast for continuous sales
      } else {
        toast.error(result.error?.message || "Could not complete sale");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-5" />
            Complete Sale
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Total display */}
          <div className="rounded-xl bg-primary/5 p-4 text-center">
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-4xl font-bold text-primary">
              {formatPrice(total, currency)}
            </p>
          </div>

          {/* Payment method */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Payment Method</Label>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_METHODS.map((method) => {
                const Icon = method.icon;
                const isSelected = paymentMethod === method.value;
                return (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(method.value);
                      setIsPayLater(false);
                    }}
                    disabled={isPending}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 transition-colors min-h-17.5",
                      isSelected && !isPayLater
                        ? "border-primary bg-primary/5 ring-2 ring-primary"
                        : "hover:bg-muted active:bg-muted/80"
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-6",
                        isSelected && !isPayLater && "text-primary"
                      )}
                    />
                    <span className="text-xs font-medium">{method.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment amount selection */}
          {!isPayLater && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Payment Amount</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsFullPayment(true);
                    setCustomAmount("");
                  }}
                  disabled={isPending}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-xl border p-4 transition-colors",
                    isFullPayment
                      ? "border-primary bg-primary/5 ring-2 ring-primary"
                      : "hover:bg-muted active:bg-muted/80"
                  )}
                >
                  <span className="text-lg font-bold">
                    {formatPrice(total, currency)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Full Payment
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsFullPayment(false)}
                  disabled={isPending}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-xl border p-4 transition-colors",
                    !isFullPayment
                      ? "border-primary bg-primary/5 ring-2 ring-primary"
                      : "hover:bg-muted active:bg-muted/80"
                  )}
                >
                  <span className="text-lg font-bold">Custom</span>
                  <span className="text-xs text-muted-foreground">
                    Partial Payment
                  </span>
                </button>
              </div>

              {/* Custom amount input */}
              {!isFullPayment && (
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="Enter amount"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="h-12 text-lg font-medium pr-16"
                    min={0}
                    max={total}
                    step="0.01"
                    autoFocus
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {currency}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Pay later option */}
          <Button
            type="button"
            variant={isPayLater ? "default" : "outline"}
            className="w-full h-12"
            onClick={() => setIsPayLater(!isPayLater)}
            disabled={isPending}
          >
            <Clock className="mr-2 size-5" />
            {isPayLater ? "Paying Later" : "Pay Later"}
          </Button>

          {isPayLater && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Order will be saved as unpaid. Customer can pay later.
            </div>
          )}

          {/* Customer info (collapsible) */}
          <Collapsible
            open={customerExpanded}
            onOpenChange={setCustomerExpanded}
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between py-2 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors">
              <div className="flex items-center gap-2">
                <User className="size-4" />
                <span className="text-sm font-medium">
                  Customer Info (optional)
                </span>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  customerExpanded && "rotate-180"
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-3 pt-2">
                <Input
                  placeholder="Customer name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  disabled={isPending}
                  className="h-11"
                />
                <Input
                  placeholder="Phone number"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  disabled={isPending}
                  className="h-11"
                />
                <Textarea
                  placeholder="Staff notes..."
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  disabled={isPending}
                  rows={2}
                  className="resize-none"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Summary */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Items ({items.reduce((sum, i) => sum + i.quantity, 0)})
              </span>
              <span>{formatPrice(total + discountAmount, currency)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-{formatPrice(discountAmount, currency)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>{formatPrice(total, currency)}</span>
            </div>
            {!isPayLater && !isFullPayment && amountReceived > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Partial Payment</span>
                <span>{formatPrice(amountReceived, currency)}</span>
              </div>
            )}
          </div>

          {/* Submit button */}
          <Button
            onClick={handleSubmit}
            disabled={isPending || items.length === 0 || !canComplete}
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
                Complete Sale
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
