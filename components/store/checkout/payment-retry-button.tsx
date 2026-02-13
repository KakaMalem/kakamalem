"use client";

import { useState } from "react";
import { Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createOrderPaymentSession } from "@/lib/actions/payments";
import { useCurrencyStore } from "@/lib/stores/use-currency-store";

interface PaymentRetryButtonProps {
  orderId: string;
  amount: number;
  currency: string;
}

export function PaymentRetryButton({
  orderId,
  amount,
  currency: _currency,
}: PaymentRetryButtonProps) {
  const { format: formatPrice } = useCurrencyStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleRetryPayment = async () => {
    setIsLoading(true);

    try {
      const result = await createOrderPaymentSession(orderId, "hesabpay");

      if (!result.success) {
        toast.error("Failed to create payment session", {
          description: result.error || "Please try again.",
        });
        setIsLoading(false);
        return;
      }

      // Redirect to HesabPay
      toast.success("Redirecting to payment...");
      window.location.href = result.paymentUrl!;
    } catch (error) {
      console.error("Payment retry error:", error);
      toast.error("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <Button
      className="w-full"
      size="lg"
      onClick={handleRetryPayment}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 size-4 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <CreditCard className="mr-2 size-4" />
          Pay {formatPrice(amount)}
        </>
      )}
    </Button>
  );
}
