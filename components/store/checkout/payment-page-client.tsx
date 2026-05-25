"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CreditCard,
  ArrowLeft,
  Loader2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCurrencyStore } from "@/lib/stores/use-currency-store";
import { useStoreBasePath } from "@/components/store/store-path-provider";
import { PaymentMethodSelector } from "./payment-method-selector";
import { createOrderPaymentSession } from "@/lib/actions/payments";
import type { EnabledGateway } from "@/lib/payments/types";
import type { PaymentGateway } from "@/lib/db/schema";
import type { PaymentMethod } from "@/lib/stores/use-checkout-store";

interface PaymentPageClientProps {
  storeSlug: string;
  orderId: string;
  orderNumber: string;
  itemCount: number;
  amount: number;
  currency: string;
  wasCancelled: boolean;
  enabledGateways: EnabledGateway[];
}

export function PaymentPageClient({
  storeSlug: _storeSlug,
  orderId,
  orderNumber,
  itemCount,
  amount,
  currency,
  wasCancelled,
  enabledGateways,
}: PaymentPageClientProps) {
  const { format: formatPrice } = useCurrencyStore();
  const basePath = useStoreBasePath();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(
    null
  );

  const handleMethodSelect = useCallback((method: PaymentMethod) => {
    setSelectedMethod(method);
  }, []);

  const handlePayment = async () => {
    if (!selectedMethod) {
      toast.error("Please select a payment method");
      return;
    }

    setIsLoading(true);

    try {
      const result = await createOrderPaymentSession(
        orderId,
        selectedMethod.gateway as PaymentGateway
      );

      if (!result.success) {
        toast.error("Failed to create payment session", {
          description: result.error || "Please try again.",
        });
        setIsLoading(false);
        return;
      }

      toast.success("Redirecting to payment...");
      window.location.href = result.paymentUrl!;
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  // If no online payment methods available
  if (enabledGateways.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-100">
            <AlertCircle className="size-8 text-amber-600" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">
            No Payment Methods Available
          </h1>
          <p className="mt-2 text-muted-foreground">
            Online payment is not available for this store. Please contact the
            store for payment options.
          </p>
        </div>
        <Button variant="outline" className="w-full" asChild>
          <Link href={`${basePath}`}>
            <ArrowLeft className="mr-2 size-4" />
            Continue Shopping
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-100">
          {wasCancelled ? (
            <AlertCircle className="size-8 text-amber-600" />
          ) : (
            <CreditCard className="size-8 text-amber-600" />
          )}
        </div>
        <h1 className="mt-4 text-2xl font-bold">
          {wasCancelled ? "Payment Cancelled" : "Complete Your Payment"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {wasCancelled
            ? "Your payment was cancelled. You can try again or cancel the order."
            : "Your order is waiting for payment."}
        </p>
      </div>

      {wasCancelled && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="size-4" />
          <AlertTitle>Payment was cancelled</AlertTitle>
          <AlertDescription>
            Don&apos;t worry - your order is saved. You can complete payment now
            or come back later.
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Order Number</span>
            <span className="font-mono font-medium">{orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Items</span>
            <span>{itemCount} items</span>
          </div>
          <div className="flex justify-between border-t pt-4">
            <span className="font-semibold">Amount Due</span>
            <span className="font-semibold">{formatPrice(amount)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Select Payment Method</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentMethodSelector
            selectedMethod={selectedMethod}
            onMethodSelect={handleMethodSelect}
            disabled={isLoading}
            currency={currency}
            enabledMethods={enabledGateways}
          />
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Button
          className="w-full"
          size="lg"
          onClick={handlePayment}
          disabled={isLoading || !selectedMethod}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Lock className="mr-2 size-4" />
              Pay {formatPrice(amount)}
            </>
          )}
        </Button>

        <Button variant="outline" className="w-full" asChild>
          <Link href={`${basePath}`}>
            <ArrowLeft className="mr-2 size-4" />
            Continue Shopping
          </Link>
        </Button>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Lock className="inline size-3 mr-1" />
        Your order will be confirmed once payment is complete. If you have any
        issues, please contact the store.
      </p>
    </div>
  );
}
