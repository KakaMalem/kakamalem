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
import {
  getThermalPrinter,
  type ReceiptData,
} from "@/lib/services/thermal-printer";
import { useIsPrinterConnected } from "@/lib/stores/use-printer-store";
import type { PaymentMethod } from "@/lib/validations/offline-sales";
import type { ReceiptPrintMode } from "@/lib/validations/stores";
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
  // Receipt printing settings
  receiptPrintMode: ReceiptPrintMode;
  storeName: string;
  storePhone: string | null;
  receiptFooterText: string | null;
  receiptPaperWidth: "58mm" | "80mm";
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
  receiptPrintMode,
  storeName,
  storePhone,
  receiptFooterText,
  receiptPaperWidth,
}: POSPaymentModalProps) {
  const [isPending, startTransition] = useTransition();
  const updateStock = usePOSProductsStore((state) => state.updateStock);
  const isPrinterConnected = useIsPrinterConnected();

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

        // Helper to trigger browser print dialog via iframe
        const triggerBrowserPrint = () => {
          const printUrl = `/dashboard/${storeSlug}/orders/${result.order!.id}/print`;
          const iframe = document.createElement("iframe");
          iframe.style.cssText =
            "position:fixed;right:0;bottom:0;width:0;height:0;border:none;";
          iframe.src = printUrl;
          iframe.onload = () => {
            setTimeout(() => {
              iframe.contentWindow?.print();
              setTimeout(() => document.body.removeChild(iframe), 1000);
            }, 500);
          };
          document.body.appendChild(iframe);
        };

        // Handle printing based on mode
        if (receiptPrintMode === "disabled") {
          // Just show success toast, no print action
          toast.success(
            `Sale completed! Receipt: ${result.order.receiptNumber}`,
            {
              duration: 5000,
              action: {
                label: "Print",
                onClick: triggerBrowserPrint,
              },
            }
          );
        } else if (receiptPrintMode === "prompt") {
          // Auto-trigger browser print dialog
          toast.success(
            `Sale completed! Receipt: ${result.order.receiptNumber}`,
            { duration: 5000 }
          );
          triggerBrowserPrint();
        } else if (receiptPrintMode === "silent") {
          // Direct thermal printer
          if (isPrinterConnected) {
            const printer = getThermalPrinter();
            const receiptData: ReceiptData = {
              storeName,
              storePhone,
              receiptNumber: result.order.receiptNumber,
              orderNumber: result.order.orderNumber,
              date: new Date().toLocaleString(),
              customerName: customerName || undefined,
              items: items.map((item) => ({
                name: item.productName,
                variantName: item.variantName,
                quantity: item.quantity,
                price: item.price,
              })),
              subtotal: total + discountAmount,
              discount: discountAmount,
              total,
              amountPaid: effectiveAmount,
              changeDue:
                effectiveAmount > total ? effectiveAmount - total : undefined,
              paymentMethod: effectiveAmount > 0 ? paymentMethod : undefined,
              currency,
              footerText: receiptFooterText,
              paperWidth: receiptPaperWidth,
            };

            printer
              .printReceipt(receiptData)
              .then(() => {
                toast.success("Sale completed! Receipt printed.", {
                  duration: 3000,
                });
              })
              .catch(() => {
                toast.error("Sale completed but printing failed", {
                  action: {
                    label: "Print Manually",
                    onClick: triggerBrowserPrint,
                  },
                });
              });
          } else {
            // No printer connected, fallback with warning
            toast.warning(
              `Sale completed! Receipt: ${result.order.receiptNumber}`,
              {
                description: "No thermal printer connected",
                action: {
                  label: "Print",
                  onClick: triggerBrowserPrint,
                },
              }
            );
          }
        }

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
