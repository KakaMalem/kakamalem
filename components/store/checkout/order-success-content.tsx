"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  Package,
  ArrowRight,
  ShoppingBag,
  Clock,
  Banknote,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatPlusCodeForDisplay } from "@/lib/geo";
import { useCurrencyStore } from "@/lib/stores/use-currency-store";
import { useStoreBasePath } from "@/components/store/store-path-provider";
import type { Address, PaymentMethod, PaymentStatus } from "@/lib/db/schema";
import { useCheckoutStore } from "@/lib/stores/use-checkout-store";
import { cartActions } from "@/lib/stores/use-cart-store";

interface ConfettiParticleProps {
  delay: number;
  x: number;
  color: string;
  xOffset: number;
  rotation: number;
  duration: number;
}

function ConfettiParticle({
  delay,
  x,
  color,
  xOffset,
  rotation,
  duration,
}: ConfettiParticleProps) {
  return (
    <motion.div
      className={`absolute w-2 h-2 rounded-full ${color}`}
      initial={{ y: -20, x, opacity: 1, scale: 1 }}
      animate={{
        y: 500,
        x: x + xOffset,
        opacity: 0,
        scale: 0,
        rotate: rotation,
      }}
      transition={{
        duration,
        delay,
        ease: "easeOut",
      }}
    />
  );
}

const CONFETTI_COLORS = [
  "bg-primary",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-pink-500",
  "bg-purple-500",
  "bg-orange-500",
];

function generateConfettiParticles() {
  // Use viewport-relative spread to avoid horizontal overflow on mobile
  const spread =
    typeof window !== "undefined"
      ? Math.min(window.innerWidth * 0.8, 600)
      : 600;
  const halfSpread = spread / 2;
  return Array.from({ length: 60 }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.8,
    x: Math.random() * spread - halfSpread,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    xOffset: (Math.random() - 0.5) * Math.min(halfSpread * 0.5, 75),
    rotation: Math.random() * 720,
    duration: 2.5 + Math.random() * 1.5,
  }));
}

interface OrderItem {
  id: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  image: {
    url: string;
    alt: string | null;
  } | null;
}

interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  items: OrderItem[];
  total: string;
  shippingAddress: Address | undefined;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
}

interface OrderSuccessContentProps {
  storeSlug: string;
  currency: string;
  order: Order | null;
  user: { id: string } | null;
  paymentStatus?: "success" | "pending" | "cancelled";
}

export function OrderSuccessContent({
  storeSlug: _storeSlug,
  currency: _currency,
  order,
  user,
  paymentStatus,
}: OrderSuccessContentProps) {
  const { format: formatPrice } = useCurrencyStore();
  const basePath = useStoreBasePath();
  const [showConfetti, setShowConfetti] = useState(true);
  const { resetCheckout } = useCheckoutStore();
  const confettiParticles = useMemo(() => generateConfettiParticles(), []);

  // Clear cart and checkout state on mount (after successful order)
  useEffect(() => {
    cartActions.clearCart();
    resetCheckout();
  }, [resetCheckout]);

  // Hide confetti after animation
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const shippingAddress = order?.shippingAddress;

  // Determine payment display info
  const isPaid = order?.paymentStatus === "paid";
  const isCOD = order?.paymentMethod === "cash";
  const isOnlinePaymentPending = paymentStatus === "pending";
  const isPaymentCancelled = paymentStatus === "cancelled";

  // Get payment status badge info
  const getPaymentBadge = () => {
    if (isPaid) {
      return { label: "Paid", variant: "default" as const, icon: CheckCircle };
    }
    if (isCOD) {
      return {
        label: "Pay on Delivery",
        variant: "secondary" as const,
        icon: Banknote,
      };
    }
    if (isPaymentCancelled) {
      return {
        label: "Payment Cancelled",
        variant: "destructive" as const,
        icon: AlertCircle,
      };
    }
    return {
      label: "Payment Pending",
      variant: "outline" as const,
      icon: Clock,
    };
  };

  const paymentBadge = getPaymentBadge();

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Confetti animation */}
      <AnimatePresence>
        {showConfetti && (
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-50 flex justify-center">
            {confettiParticles.map((particle) => (
              <ConfettiParticle
                key={particle.id}
                delay={particle.delay}
                x={particle.x}
                color={particle.color}
                xOffset={particle.xOffset}
                rotation={particle.rotation}
                duration={particle.duration}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-2xl text-center">
        {/* Success Icon */}
        <motion.div
          className="mx-auto flex size-20 items-center justify-center rounded-full bg-green-100"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 15,
            delay: 0.1,
          }}
        >
          <CheckCircle className="size-10 text-green-600" />
        </motion.div>

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="mt-6 text-3xl font-bold">Thank you for your order!</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            {isPaid
              ? "Payment received! Your order is being processed."
              : isCOD
                ? "Your order is confirmed. Pay when you receive your items."
                : "Your order has been placed and is being processed."}
          </p>
        </motion.div>

        {/* Payment Alert for pending/cancelled */}
        {(isOnlinePaymentPending || isPaymentCancelled) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Alert
              variant={isPaymentCancelled ? "destructive" : "default"}
              className="mt-6 text-left"
            >
              <AlertCircle className="size-4" />
              <AlertTitle>
                {isPaymentCancelled
                  ? "Payment was cancelled"
                  : "Payment not completed"}
              </AlertTitle>
              <AlertDescription>
                {isPaymentCancelled
                  ? "Your payment was cancelled. Your order is saved and you can try again."
                  : "We couldn't process your payment. Your order is saved and you can complete payment later."}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Order Details */}
        {order && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="mt-8 text-left">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Order Number
                    </p>
                    <p className="text-lg font-semibold">{order.orderNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">
                      {new Date(order.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                {/* Payment Status Badge */}
                <div className="mt-4">
                  <Badge variant={paymentBadge.variant} className="gap-1.5">
                    <paymentBadge.icon className="size-3.5" />
                    {paymentBadge.label}
                  </Badge>
                </div>

                <Separator className="my-4" />

                {/* Items Summary */}
                <div className="space-y-3">
                  <p className="font-medium">Items ({order.items.length})</p>
                  {order.items.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="relative size-10 shrink-0 overflow-hidden rounded bg-muted">
                        {item.image?.url ? (
                          <Image
                            src={item.image.url}
                            alt={item.image.alt || item.productName}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center">
                            <Package className="size-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-1">
                          {item.productName}
                        </p>
                        {item.variantName && (
                          <p className="text-xs text-muted-foreground">
                            {item.variantName}
                          </p>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        &times;{item.quantity}
                      </div>
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <p className="text-sm text-muted-foreground">
                      +{order.items.length - 3} more items
                    </p>
                  )}
                </div>

                <Separator className="my-4" />

                {/* Delivery Location */}
                {shippingAddress && (
                  <div>
                    <p className="font-medium mb-2">Delivering to</p>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {(shippingAddress.firstName ||
                        shippingAddress.lastName) && (
                        <p>
                          {shippingAddress.firstName} {shippingAddress.lastName}
                        </p>
                      )}
                      <p className="font-mono">
                        {shippingAddress.plusCode
                          ? formatPlusCodeForDisplay(
                              shippingAddress.plusCode,
                              shippingAddress.city
                            )
                          : `${shippingAddress.latitude.toFixed(
                              6
                            )}, ${shippingAddress.longitude.toFixed(6)}`}
                      </p>
                      <a
                        href={`https://www.google.com/maps?q=${shippingAddress.latitude},${shippingAddress.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        View on Google Maps
                      </a>
                      {shippingAddress.notes && (
                        <p className="mt-1">{shippingAddress.notes}</p>
                      )}
                    </div>
                  </div>
                )}

                {shippingAddress && <Separator className="my-4" />}

                {/* Total */}
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>{formatPrice(parseFloat(order.total))}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Guest Order (no order details) */}
        {!order && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="mt-8">
              <CardContent className="p-6">
                <p className="text-muted-foreground">
                  We&apos;ve sent a confirmation email with your order details.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* What's Next */}
        <motion.div
          className="mt-8 rounded-lg border bg-muted/30 p-6 text-left"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="font-semibold">What happens next?</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                1
              </span>
              <span>
                We&apos;ll send you an email confirmation with your order
                details.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                2
              </span>
              <span>
                Once your order ships, you&apos;ll receive tracking information.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                3
              </span>
              <span>
                Your order will be delivered to your shipping address.
              </span>
            </li>
            {isCOD && (
              <li className="flex items-start gap-2">
                <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  4
                </span>
                <span>
                  Pay the delivery person when you receive your items.
                </span>
              </li>
            )}
          </ul>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {/* Complete Payment button for unpaid online orders */}
          {order && !isPaid && !isCOD && (
            <Button asChild>
              <Link href={`${basePath}/checkout/payment?order=${order.id}`}>
                Complete Payment
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          )}
          {user && order && (
            <Button variant={!isPaid && !isCOD ? "outline" : "default"} asChild>
              <Link href={`${basePath}/account/orders/${order.id}`}>
                View Order Details
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href={`${basePath}`}>
              <ShoppingBag className="mr-2 size-4" />
              Continue Shopping
            </Link>
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
