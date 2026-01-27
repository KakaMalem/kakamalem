"use client";

import { useState } from "react";
import {
  ChevronDown,
  CreditCard,
  Check,
  Receipt,
  Truck,
  Tag,
  Calculator,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  parseOrderFinancials,
  calculatePaymentState,
  getPaymentStatusConfig,
} from "@/lib/utils/order-calculations";
import { OrderPaymentSection } from "./order-payment-section";
import { OrderShippingAdjustment } from "./order-shipping-adjustment";
import { OrderTotalAdjustment } from "./order-total-adjustment";
import { OrderRefund } from "./order-refund";
import type { OrderPaymentRecord } from "@/lib/db/queries/orders";

interface OrderSummaryCardProps {
  orderId: string;
  tenantId: string;
  storeSlug: string;
  currency: string;
  // Financial data (as strings from DB)
  subtotal: string;
  shippingTotal: string;
  taxTotal: string;
  discountTotal: string;
  total: string;
  amountPaid: string;
  amountRefunded: string;
  // Payment state
  isPaid: boolean;
  payments: OrderPaymentRecord[];
  // Display options
  showBreakdown?: boolean;
  showActions?: boolean;
  compact?: boolean;
}

export function OrderSummaryCard({
  orderId,
  tenantId,
  storeSlug,
  currency,
  subtotal,
  shippingTotal,
  taxTotal,
  discountTotal,
  total,
  amountPaid,
  amountRefunded,
  isPaid,
  payments,
  showBreakdown = true,
  showActions = true,
  compact = false,
}: OrderSummaryCardProps) {
  const [breakdownOpen, setBreakdownOpen] = useState(!compact);
  const [actionsOpen, setActionsOpen] = useState(false);

  // Parse financials and calculate payment state
  const financials = parseOrderFinancials({
    subtotal,
    shippingTotal,
    taxTotal,
    discountTotal,
    total,
    amountPaid,
    amountRefunded,
  });

  const paymentState = calculatePaymentState(financials);
  const statusConfig = getPaymentStatusConfig(paymentState.status);

  const formatPrice = (amount: number) => {
    return `${amount.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })} ${currency}`;
  };

  // Determine if refund section should show
  const showRefund = isPaid || financials.amountPaid > 0 || payments.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-5" />
            Order Summary
          </CardTitle>
          <Badge
            variant={
              paymentState.status === "unpaid" ? "destructive" : "default"
            }
            className={cn(
              paymentState.status === "paid" && "bg-green-500",
              paymentState.status === "partial" && "bg-amber-500",
              paymentState.status === "overpaid" && "bg-blue-500"
            )}
          >
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Total Display */}
        <div className="text-center py-2">
          <p className="text-3xl font-bold">{formatPrice(financials.total)}</p>
          {paymentState.hasOverpayment && (
            <p className="text-sm text-blue-600 mt-1">
              Credit: {formatPrice(paymentState.creditAmount)}
            </p>
          )}
        </div>

        {/* Payment Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {formatPrice(paymentState.netPaid)} paid
            </span>
            <span className="font-medium">
              {Math.round(paymentState.paidPercentage)}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all duration-300",
                statusConfig.color
              )}
              style={{ width: `${paymentState.paidPercentage}%` }}
            />
          </div>
          {!paymentState.isFullyPaid && (
            <p className="text-sm text-muted-foreground text-center">
              {formatPrice(paymentState.amountDue)} remaining
            </p>
          )}
        </div>

        {/* Breakdown Section */}
        {showBreakdown && (
          <>
            <Separator />
            <Collapsible open={breakdownOpen} onOpenChange={setBreakdownOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between py-1 text-sm font-medium hover:text-primary transition-colors">
                <span className="flex items-center gap-2">
                  <Calculator className="size-4" />
                  Price Breakdown
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    breakdownOpen && "rotate-180"
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatPrice(financials.subtotal)}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Truck className="size-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Shipping</span>
                      {showActions && (
                        <OrderShippingAdjustment
                          orderId={orderId}
                          tenantId={tenantId}
                          currency={currency}
                          currentShipping={shippingTotal}
                          subtotal={subtotal}
                        />
                      )}
                    </div>
                    <span>
                      {financials.shippingTotal > 0
                        ? formatPrice(financials.shippingTotal)
                        : "Free"}
                    </span>
                  </div>

                  {financials.taxTotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax</span>
                      <span>{formatPrice(financials.taxTotal)}</span>
                    </div>
                  )}

                  {financials.discountTotal > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span className="flex items-center gap-2">
                        <Tag className="size-3.5" />
                        Discount
                      </span>
                      <span>-{formatPrice(financials.discountTotal)}</span>
                    </div>
                  )}

                  <Separator className="my-2" />

                  <div className="flex justify-between items-center font-semibold">
                    <span>Total</span>
                    <div className="flex items-center gap-2">
                      {showActions && (
                        <OrderTotalAdjustment
                          orderId={orderId}
                          tenantId={tenantId}
                          currency={currency}
                          subtotal={subtotal}
                          shippingTotal={shippingTotal}
                          taxTotal={taxTotal}
                          discountTotal={discountTotal}
                          currentTotal={total}
                        />
                      )}
                      <span>{formatPrice(financials.total)}</span>
                    </div>
                  </div>

                  {financials.amountRefunded > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Refunded</span>
                      <span>-{formatPrice(financials.amountRefunded)}</span>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}

        {/* Payment Status Indicator */}
        {paymentState.isFullyPaid && !paymentState.hasOverpayment && (
          <div
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg p-3",
              statusConfig.bgColor,
              statusConfig.textColor
            )}
          >
            <Check className="size-5" />
            <span className="font-medium">Fully Paid</span>
          </div>
        )}

        {paymentState.hasOverpayment && (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-blue-50 p-3 text-blue-700">
            <CreditCard className="size-5" />
            <span className="font-medium">
              Credit: {formatPrice(paymentState.creditAmount)}
            </span>
          </div>
        )}

        {/* Actions Section */}
        {showActions && (
          <>
            <Separator />
            <Collapsible open={actionsOpen} onOpenChange={setActionsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between h-11"
                >
                  <span className="flex items-center gap-2">
                    <CreditCard className="size-4" />
                    Payment & Actions
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform",
                      actionsOpen && "rotate-180"
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pt-4 space-y-4">
                  {/* Inline Payment Section */}
                  <OrderPaymentSection
                    orderId={orderId}
                    tenantId={tenantId}
                    storeSlug={storeSlug}
                    currency={currency}
                    orderTotal={total}
                    totalPaid={amountPaid}
                    amountRefunded={amountRefunded}
                    amountRemaining={paymentState.amountDue.toString()}
                    isPaid={isPaid}
                    payments={payments}
                  />

                  {/* Refund Section */}
                  {showRefund && (
                    <div className="pt-2 border-t">
                      <p className="text-sm font-medium mb-3">Process Refund</p>
                      <OrderRefund
                        orderId={orderId}
                        tenantId={tenantId}
                        currency={currency}
                        orderTotal={total}
                        amountPaid={amountPaid}
                        amountRefunded={amountRefunded}
                        isPaid={isPaid}
                      />
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </CardContent>
    </Card>
  );
}
