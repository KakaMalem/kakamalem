"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft,
  Package,
  MapPin,
  Truck,
  AlertCircle,
  Loader2,
  Tag,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldLabel } from "@/components/ui/field";
import { formatPrice } from "@/lib/utils";
import { formatPlusCodeForDisplay } from "@/lib/geo";
import { useCheckoutStore } from "@/lib/stores/use-checkout-store";
import { getApplicableTierPrice } from "@/lib/stores/use-cart-store";
import { createOrderAction, validateCartAction } from "@/lib/actions/checkout";
import type { Cart } from "@/lib/db/queries/carts";
import { toast } from "sonner";

interface StepReviewProps {
  tenantId: string;
  storeSlug: string;
  currency: string;
  cart: Cart;
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export function StepReview({
  tenantId,
  storeSlug,
  currency,
  cart,
  user,
}: StepReviewProps) {
  const router = useRouter();

  const {
    customerInfo,
    shippingAddress,
    selectedMethod,
    customerNotes,
    subtotal,
    shippingTotal,
    total,
    setCustomerNotes,
    setStep,
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

  // Navigate to previous step
  const handleBack = () => {
    setStep(2);
  };

  // Place order
  const handlePlaceOrder = async () => {
    if (!shippingAddress || !selectedMethod) {
      toast.error("Missing shipping information");
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
        billingAddress: null, // Same as shipping for now
        shippingMethodId: selectedMethod.id,
        customerNotes: customerNotes || null,
      });

      if (!result.success) {
        const errorCode = result.error?.code;
        const errorMessage = result.error?.message || "Failed to place order";

        // Handle specific error codes
        switch (errorCode) {
          case "CART_NOT_FOUND":
          case "CART_EMPTY":
            toast.error("Your cart is empty", {
              description: "Please add items to your cart before checking out.",
            });
            router.replace(`/store/${storeSlug}/cart?error=empty`);
            return;

          case "CART_INVALID":
            if (result.error?.cartErrors) {
              setCartErrors(result.error.cartErrors);
            }
            toast.error("Some items need attention", {
              description: "Please review your cart and update quantities.",
            });
            setIsSubmitting(false);
            return;

          case "OUTSIDE_DELIVERY_ZONE":
            toast.error("Delivery not available", {
              description: errorMessage,
            });
            setStep(1); // Go back to address step
            setIsSubmitting(false);
            return;

          case "MIN_ORDER_NOT_MET":
            toast.error("Minimum order not met", {
              description: errorMessage,
            });
            setIsSubmitting(false);
            return;

          case "SHIPPING_METHOD_REQUIRED":
            toast.error("Shipping method required", {
              description: "Please select a shipping method.",
            });
            setStep(2); // Go back to shipping step
            setIsSubmitting(false);
            return;

          case "VALIDATION_ERROR":
            toast.error("Invalid information", {
              description: errorMessage,
            });
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

      // Success! Redirect to confirmation page (cart clearing happens there)
      toast.success("Order placed successfully!");
      router.replace(
        `/store/${storeSlug}/checkout/success?order=${result.order?.id}`
      );
    } catch (error) {
      console.error("Failed to place order:", error);
      toast.error("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  // Format delivery estimate
  const formatDeliveryEstimate = (): string => {
    if (!selectedMethod) return "";
    const { minDeliveryDays, maxDeliveryDays } = selectedMethod;
    if (minDeliveryDays === null && maxDeliveryDays === null) return "";
    if (minDeliveryDays === maxDeliveryDays && minDeliveryDays !== null) {
      return `${minDeliveryDays} ${minDeliveryDays === 1 ? "day" : "days"}`;
    }
    if (minDeliveryDays !== null && maxDeliveryDays !== null) {
      return `${minDeliveryDays}-${maxDeliveryDays} days`;
    }
    return "";
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

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="size-5" />
            Order Items ({cart.items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {cart.items.map((item) => {
              const basePrice = item.variant?.price
                ? parseFloat(item.variant.price)
                : parseFloat(item.product.price);

              // Apply tier pricing
              const effectivePrice = getApplicableTierPrice(
                basePrice,
                item.quantity,
                item.product.priceTiers || []
              );

              const hasTierDiscount = effectivePrice < basePrice;

              return (
                <div key={item.id} className="flex gap-4">
                  {/* Image */}
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                    {item.product.image?.url ? (
                      <Image
                        src={item.product.image.url}
                        alt={item.product.image.altText || item.product.name}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="size-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium line-clamp-1">
                      {item.product.name}
                    </p>
                    {item.variant?.displayName && (
                      <p className="text-sm text-muted-foreground">
                        {item.variant.displayName}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Qty: {item.quantity}
                    </p>
                    {hasTierDiscount && (
                      <div className="flex items-center gap-1 text-xs text-green-600 mt-0.5">
                        <Tag className="size-3" />
                        <span>Bulk discount</span>
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div className="shrink-0 text-right">
                    <p className="font-medium">
                      {formatPrice(effectivePrice * item.quantity, currency)}
                    </p>
                    {hasTierDiscount ? (
                      <>
                        <p className="text-sm text-green-600">
                          {formatPrice(effectivePrice, currency)} each
                        </p>
                        <p className="text-xs text-muted-foreground line-through">
                          {formatPrice(basePrice, currency)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {formatPrice(basePrice, currency)} each
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Delivery Location */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="size-5" />
              Delivery Location
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(1)}
              disabled={isSubmitting}
            >
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {shippingAddress && (
            <div className="text-sm space-y-1">
              <p className="font-medium">
                {shippingAddress.firstName} {shippingAddress.lastName}
              </p>
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="size-3" />
                <span className="font-mono">
                  {shippingAddress.plusCode
                    ? formatPlusCodeForDisplay(
                        shippingAddress.plusCode,
                        shippingAddress.city
                      )
                    : `${shippingAddress.latitude.toFixed(
                        6
                      )}, ${shippingAddress.longitude.toFixed(6)}`}
                </span>
              </div>
              <a
                href={`https://www.google.com/maps?q=${shippingAddress.latitude},${shippingAddress.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                View on Google Maps
              </a>
              {shippingAddress.notes && (
                <p className="text-muted-foreground mt-2">
                  {shippingAddress.notes}
                </p>
              )}
              {shippingAddress.phone && (
                <p className="text-muted-foreground mt-2">
                  Phone: {shippingAddress.phone}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shipping Method */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Truck className="size-5" />
              Shipping Method
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(2)}
              disabled={isSubmitting}
            >
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {selectedMethod && (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{selectedMethod.name}</p>
                {selectedMethod.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedMethod.description}
                  </p>
                )}
                {formatDeliveryEstimate() && (
                  <p className="text-sm text-muted-foreground">
                    Estimated delivery: {formatDeliveryEstimate()}
                  </p>
                )}
              </div>
              <div className="font-semibold">
                {selectedMethod.price === 0 ? (
                  <span className="text-green-600">Free</span>
                ) : (
                  formatPrice(selectedMethod.price, currency)
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Order Notes (Optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Field>
            <FieldLabel>Add a note to your order</FieldLabel>
            <Textarea
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="Special delivery instructions, gift message, etc."
              rows={3}
              disabled={isSubmitting}
              maxLength={1000}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Order Total */}
      <Card>
        <CardContent className="p-6">
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
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
          <ChevronLeft className="mr-2 size-4" />
          Back
        </Button>
        <Button
          onClick={handlePlaceOrder}
          disabled={isSubmitting || cartErrors.length > 0}
          size="lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Placing Order...
            </>
          ) : (
            <>Place Order - {formatPrice(total, currency)}</>
          )}
        </Button>
      </div>
    </div>
  );
}
