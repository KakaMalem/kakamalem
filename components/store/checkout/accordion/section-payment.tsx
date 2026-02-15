"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Lock, Tag, MapPin, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldLabel } from "@/components/ui/field";
import { useCurrencyStore } from "@/lib/stores/use-currency-store";
import {
  useCheckoutStore,
  useAppliedCoupon,
} from "@/lib/stores/use-checkout-store";
import { getApplicableTierPrice } from "@/lib/stores/use-cart-store";
import { PromoCodeInput } from "../promo-code-input";
import { createOrderAction, validateCartAction } from "@/lib/actions/checkout";
import { createOrderPaymentSession } from "@/lib/actions/payments";
import { PaymentMethodSelector } from "../payment-method-selector";
import { useStoreBasePath } from "@/components/store/store-path-provider";
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
  showPromoCode?: boolean;
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
  showPromoCode = false,
  onEditDelivery,
  onEditShipping,
}: SectionPaymentProps) {
  const router = useRouter();
  const basePath = useStoreBasePath();
  const {
    format: formatPrice,
    currency: customerCurrency,
    storeCurrency,
    rates,
  } = useCurrencyStore();

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

  const { appliedCoupon, discountTotal } = useAppliedCoupon();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cartErrors, setCartErrors] = useState<
    Array<{ itemId: string; productName: string; error: string }>
  >([]);
  const [selectedNetwork, setSelectedNetwork] = useState<string>(() => {
    const cryptoGateway = enabledPaymentMethods.find(
      (g) => g.gateway === "crypto_usdt"
    );
    return cryptoGateway?.cryptoNetworks?.[0]?.network || "trc20";
  });

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
        router.push(`${basePath}/cart`);
        return;
      }

      // Build multi-currency fields if customer is viewing in a different currency
      const currencyFields: {
        customerCurrency?: string;
        exchangeRateUsed?: number;
        exchangeRateLockedAt?: string;
      } = {};
      if (customerCurrency !== storeCurrency) {
        const storeRate =
          storeCurrency === "AFN" ? 1 : rates[storeCurrency] || 1;
        const targetRate =
          customerCurrency === "AFN" ? 1 : rates[customerCurrency] || 1;
        currencyFields.customerCurrency = customerCurrency;
        currencyFields.exchangeRateUsed = targetRate / storeRate;
        currencyFields.exchangeRateLockedAt = new Date().toISOString();
      }

      // Create order
      const result = await createOrderAction(tenantId, storeSlug, {
        customerInfo: user ? null : customerInfo,
        shippingAddress,
        billingAddress: null,
        shippingMethodId: selectedMethod.id,
        customerNotes: customerNotes || null,
        paymentMethod: selectedPaymentMethod.gateway,
        appliedCouponCode: appliedCoupon?.code || null,
        ...currencyFields,
      });

      if (!result.success) {
        const errorCode = result.error?.code;
        const errorMessage = result.error?.message || "Failed to place order";

        switch (errorCode) {
          case "CART_NOT_FOUND":
          case "CART_EMPTY":
            toast.error("Your cart is empty");
            router.replace(`${basePath}/cart?error=empty`);
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
      const gateway = selectedPaymentMethod.gateway;

      // Online payment gateways that require redirect
      if (
        gateway === "hesabpay" ||
        gateway === "stripe" ||
        gateway === "crypto_usdt"
      ) {
        const paymentResult = await createOrderPaymentSession(
          orderId!,
          gateway,
          gateway === "crypto_usdt" ? { network: selectedNetwork } : undefined
        );

        if (!paymentResult.success) {
          toast.error("Failed to create payment session", {
            description: paymentResult.error || "Please try again.",
          });
          router.replace(
            `${basePath}/checkout/success?order=${orderId}&payment=pending`
          );
          return;
        }

        toast.success(
          gateway === "crypto_usdt"
            ? "Redirecting to crypto payment..."
            : "Redirecting to payment..."
        );
        window.location.href = paymentResult.paymentUrl!;
      } else {
        // COD, bank transfer, etc. - no online payment needed
        toast.success("Order placed successfully!");
        router.replace(`${basePath}/checkout/success?order=${orderId}`);
      }
    } catch (error) {
      console.error("Failed to place order:", error);
      toast.error("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  // Check if previous steps are completed
  const missingDelivery = !shippingAddress;
  const missingShipping = !selectedMethod;
  const hasMissingSteps = missingDelivery || missingShipping;

  return (
    <div className="space-y-6">
      {/* Missing Steps Message */}
      {hasMissingSteps && (
        <div className="rounded-lg border border-muted bg-muted/30 p-6 text-center">
          <Lock className="mx-auto size-10 text-muted-foreground/50 mb-3" />
          <p className="font-medium text-foreground">
            Complete the previous steps first
          </p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            To place your order, please complete the following:
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {missingDelivery && (
              <Button variant="outline" onClick={onEditDelivery}>
                <MapPin className="mr-2 size-4" />
                Add Delivery Address
              </Button>
            )}
            {!missingDelivery && missingShipping && (
              <Button variant="outline" onClick={onEditShipping}>
                <Truck className="mr-2 size-4" />
                Select Shipping Method
              </Button>
            )}
          </div>
        </div>
      )}

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
              onClick={() => router.push(`${basePath}/cart`)}
            >
              Update Cart
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Payment form - only show when previous steps are complete */}
      {!hasMissingSteps && (
        <>
          {/* Payment Method Selector */}
          <div>
            <h4 className="font-medium mb-3">Select Payment Method</h4>
            <PaymentMethodSelector
              selectedMethod={selectedPaymentMethod}
              onMethodSelect={setPaymentMethod}
              disabled={isSubmitting}
              currency={currency}
              enabledMethods={enabledPaymentMethods}
              selectedNetwork={selectedNetwork}
              onNetworkSelect={setSelectedNetwork}
            />
          </div>

          {/* Promo Code Input - only show if store has active coupons */}
          {showPromoCode && (
            <PromoCodeInput
              tenantId={tenantId}
              subtotal={subtotal}
              cartItems={cart.items.map((item) => ({
                productId: item.productId,
                categoryId: null, // Cart items don't include categoryId
                quantity: item.quantity,
                lineTotal:
                  getApplicableTierPrice(
                    item.variant?.price
                      ? parseFloat(item.variant.price)
                      : parseFloat(item.product.price),
                    item.quantity,
                    item.product.priceTiers || []
                  ) * item.quantity,
              }))}
              customerId={user?.id || null}
              currency={currency}
            />
          )}

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
                <span>{formatPrice(subtotal)}</span>
              </div>
              {totalBulkSavings > 0 && (
                <div className="flex items-center justify-between text-green-600">
                  <span className="flex items-center gap-1.5">
                    <Tag className="size-3.5" />
                    Bulk discounts
                  </span>
                  <span>-{formatPrice(totalBulkSavings)}</span>
                </div>
              )}
              {appliedCoupon && discountTotal > 0 && (
                <div className="flex items-center justify-between gap-2 text-green-600">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Tag className="size-3.5 shrink-0" />
                    <span className="truncate">{appliedCoupon.code}</span>
                  </span>
                  <span className="shrink-0">
                    -{formatPrice(discountTotal)}
                  </span>
                </div>
              )}
              {appliedCoupon?.type === "free_shipping" && (
                <div className="flex items-center justify-between gap-2 text-green-600">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Tag className="size-3.5 shrink-0" />
                    <span className="truncate">{appliedCoupon.code}</span>
                  </span>
                  <span className="shrink-0">Free shipping</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>
                  {shippingTotal === 0 ? (
                    <span className="text-green-600">Free</span>
                  ) : (
                    formatPrice(shippingTotal)
                  )}
                </span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
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
                {selectedPaymentMethod?.gateway === "hesabpay" ||
                selectedPaymentMethod?.gateway === "stripe" ||
                selectedPaymentMethod?.gateway === "crypto_usdt"
                  ? "Processing..."
                  : "Placing Order..."}
              </>
            ) : selectedPaymentMethod?.gateway === "hesabpay" ||
              selectedPaymentMethod?.gateway === "stripe" ||
              selectedPaymentMethod?.gateway === "crypto_usdt" ? (
              <>
                <Lock className="mr-2 size-4" />
                Pay {formatPrice(total)}
              </>
            ) : (
              <>
                <Lock className="mr-2 size-4" />
                Place Order &bull; {formatPrice(total)}
              </>
            )}
          </Button>

          {/* Security Note */}
          <p className="text-xs text-center text-muted-foreground">
            <Lock className="inline size-3 mr-1" />
            Your payment information is secure. By placing this order, you agree
            to our Terms of Service.
          </p>
        </>
      )}
    </div>
  );
}
