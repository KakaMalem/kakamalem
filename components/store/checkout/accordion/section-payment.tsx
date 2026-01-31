"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Lock, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldLabel } from "@/components/ui/field";
import { formatPrice } from "@/lib/utils";
import { useCheckoutStore } from "@/lib/stores/use-checkout-store";
import { getApplicableTierPrice } from "@/lib/stores/use-cart-store";
import { createOrderAction, validateCartAction } from "@/lib/actions/checkout";
import { createOrderPaymentSession } from "@/lib/actions/payments";
import { PaymentMethodSelector } from "../payment-method-selector";
import type { Cart } from "@/lib/db/queries/carts";
import type { EnabledGateway } from "@/lib/payments/types";

interface SectionPaymentProps {
  tenantId: string;
  storeSlug: string;
  currency: string;
  cart: Cart;
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  enabledPaymentMethods: EnabledGateway[];
  onEditDelivery: () => void;
  onEditShipping: () => void;
}

export function SectionPayment({
  tenantId,
  storeSlug,
  currency,
  cart,
  user,
  enabledPaymentMethods,
  onEditDelivery,
  onEditShipping,
}: SectionPaymentProps) {
  const router = useRouter();

  const {
    customerInfo,
    shippingAddress,
    selectedMethod,
    selectedPaymentMethod,
    customerNotes,
    subtotal,
    shippingTotal,
    total,
    setCustomerNotes,
    setPaymentMethod,
  } = useCheckoutStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cartErrors, setCartErrors] = useState<
    Array<{ itemId: string; productName: string; error: string }>
  >([]);

  // Calculate total bulk savings from tier pricing
  const totalBulkSavings = useMemo(() => {
    return cart.items.reduce((savings, item) => {
      const basePrice = item.variant?.price
        ? parseFloat(item.variant.price)
        : parseFloat(item.product.price);
      const effectivePrice = getApplicableTierPrice(
        basePrice,
        item.quantity,
        item.product.priceTiers || []
      );
      return savings + (basePrice - effectivePrice) * item.quantity;
    }, 0);
  }, [cart.items]);

  // Place order
  const handlePlaceOrder = async () => {
    if (!shippingAddress || !selectedMethod) {
      toast.error("Missing shipping information");
      return;
    }

    if (!selectedPaymentMethod) {
      toast.error("Please select a payment method");
      return;
    }

    setIsSubmitting(true);
    setCartErrors([]);

    try {
      // Re-validate cart before submission
      const validation = await validateCartAction(tenantId);

      if (!validation.valid) {
        setCartErrors(validation.errors);
        toast.error("Some items in your cart are no longer available");
        setIsSubmitting(false);
        return;
      }

      if (validation.isEmpty) {
        toast.error("Your cart is empty");
        router.push(`/store/${storeSlug}/cart`);
        return;
      }

      // Create order
      const result = await createOrderAction(tenantId, storeSlug, {
        customerInfo: user ? null : customerInfo,
        shippingAddress,
        billingAddress: null,
        shippingMethodId: selectedMethod.id,
        customerNotes: customerNotes || null,
        paymentMethod: selectedPaymentMethod.gateway,
      });

      if (!result.success) {
        const errorCode = result.error?.code;
        const errorMessage = result.error?.message || "Failed to place order";

        switch (errorCode) {
          case "CART_NOT_FOUND":
          case "CART_EMPTY":
            toast.error("Your cart is empty");
            router.replace(`/store/${storeSlug}/cart?error=empty`);
            return;

          case "CART_INVALID":
            if (result.error?.cartErrors) {
              setCartErrors(result.error.cartErrors);
            }
            toast.error("Some items need attention");
            setIsSubmitting(false);
            return;

          case "OUTSIDE_DELIVERY_ZONE":
            toast.error("Delivery not available", {
              description: errorMessage,
            });
            onEditDelivery();
            setIsSubmitting(false);
            return;

          case "MIN_ORDER_NOT_MET":
            toast.error("Minimum order not met", { description: errorMessage });
            setIsSubmitting(false);
            return;

          case "SHIPPING_METHOD_REQUIRED":
            toast.error("Shipping method required");
            onEditShipping();
            setIsSubmitting(false);
            return;

          case "VALIDATION_ERROR":
            toast.error("Invalid information", { description: errorMessage });
            setIsSubmitting(false);
            return;

          default:
            if (result.error?.cartErrors) {
              setCartErrors(result.error.cartErrors);
            }
            toast.error(errorMessage);
            setIsSubmitting(false);
            return;
        }
      }

      const orderId = result.order?.id;

      // Handle payment based on selected method
      if (selectedPaymentMethod.gateway === "hesabpay") {
        const paymentResult = await createOrderPaymentSession(
          orderId!,
          "hesabpay"
        );

        if (!paymentResult.success) {
          toast.error("Failed to create payment session", {
            description: paymentResult.error || "Please try again.",
          });
          router.replace(
            `/store/${storeSlug}/checkout/success?order=${orderId}&payment=pending`
          );
          return;
        }

        toast.success("Redirecting to payment...");
        window.location.href = paymentResult.paymentUrl!;
      } else {
        toast.success("Order placed successfully!");
        router.replace(`/store/${storeSlug}/checkout/success?order=${orderId}`);
      }
    } catch (error) {
      console.error("Failed to place order:", error);
      toast.error("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cart Errors Alert */}
      {cartErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Some items need attention</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc pl-4 space-y-1">
              {cartErrors.map((error) => (
                <li key={error.itemId}>
                  <span className="font-medium">{error.productName}</span>:{" "}
                  {error.error}
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => router.push(`/store/${storeSlug}/cart`)}
            >
              Update Cart
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Payment Method Selector */}
      <div>
        <h4 className="font-medium mb-3">Select Payment Method</h4>
        <PaymentMethodSelector
          selectedMethod={selectedPaymentMethod}
          onMethodSelect={setPaymentMethod}
          disabled={isSubmitting}
          currency={currency}
          enabledMethods={enabledPaymentMethods}
        />
      </div>

      {/* Order Notes */}
      <Field>
        <FieldLabel>
          Order Notes
          <span className="text-muted-foreground font-normal ml-1">
            (optional)
          </span>
        </FieldLabel>
        <Textarea
          value={customerNotes}
          onChange={(e) => setCustomerNotes(e.target.value)}
          placeholder="Special delivery instructions, gift message, etc."
          rows={3}
          disabled={isSubmitting}
          maxLength={1000}
        />
      </Field>

      {/* Order Total Summary */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatPrice(subtotal, currency)}</span>
          </div>
          {totalBulkSavings > 0 && (
            <div className="flex items-center justify-between text-green-600">
              <span className="flex items-center gap-1.5">
                <Tag className="size-3.5" />
                Bulk discounts
              </span>
              <span>-{formatPrice(totalBulkSavings, currency)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shipping</span>
            <span>
              {shippingTotal === 0 ? (
                <span className="text-green-600">Free</span>
              ) : (
                formatPrice(shippingTotal, currency)
              )}
            </span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatPrice(total, currency)}</span>
          </div>
        </div>
      </div>

      {/* Place Order Button */}
      <Button
        onClick={handlePlaceOrder}
        disabled={
          isSubmitting || cartErrors.length > 0 || !selectedPaymentMethod
        }
        size="lg"
        className="w-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            {selectedPaymentMethod?.gateway === "hesabpay"
              ? "Processing..."
              : "Placing Order..."}
          </>
        ) : selectedPaymentMethod?.gateway === "hesabpay" ? (
          <>
            <Lock className="mr-2 size-4" />
            Pay {formatPrice(total, currency)}
          </>
        ) : (
          <>
            <Lock className="mr-2 size-4" />
            Place Order &bull; {formatPrice(total, currency)}
          </>
        )}
      </Button>

      {/* Security Note */}
      <p className="text-xs text-center text-muted-foreground">
        <Lock className="inline size-3 mr-1" />
        Your payment information is secure. By placing this order, you agree to
        our Terms of Service.
      </p>
    </div>
  );
}
