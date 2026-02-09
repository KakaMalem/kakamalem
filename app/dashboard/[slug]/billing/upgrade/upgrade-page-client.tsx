"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  Building2,
  Loader2,
  Crown,
  Check,
  Shield,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  initiateProUpgrade,
  initiateProUpgradeWithCrypto,
} from "@/lib/actions/subscriptions";
import { BillingIntervalSelector } from "@/components/dashboard/billing/billing-interval-selector";
import type { SubscriptionOverview } from "@/lib/db/queries/billing";
import type { ProPriceInfo } from "@/lib/stripe";
import type { BillingInterval } from "@/lib/db/schema";

// =============================================================================
// UPGRADE PAGE CLIENT COMPONENT
// =============================================================================
// Payment method selection for Pro upgrade
// =============================================================================

interface UpgradePageClientProps {
  tenantId: string;
  storeSlug: string;
  storeName: string;
  subscription: SubscriptionOverview;
  stripeEnabled: boolean;
  stripePriceInfo: ProPriceInfo | null;
  stripeYearlyPriceInfo: ProPriceInfo | null;
  cryptoEnabled?: boolean;
  cryptoWalletConfig?: {
    trc20?: { address: string; enabled: boolean };
    erc20?: { address: string; enabled: boolean };
    bep20?: { address: string; enabled: boolean };
  } | null;
}

type PaymentMethod = "stripe" | "hesabpay" | "crypto";
type CryptoNetwork = "trc20" | "erc20" | "bep20";

// Fixed USDT prices (matching Stripe USD pricing)
const USDT_MONTHLY_PRICE = 20;
const USDT_YEARLY_PRICE = 200;

function formatPrice(price: string | number): string {
  const value = typeof price === "string" ? parseFloat(price) : price;
  return value.toLocaleString();
}

export function UpgradePageClient({
  tenantId,
  storeSlug,
  storeName,
  subscription,
  stripeEnabled,
  stripePriceInfo,
  stripeYearlyPriceInfo,
  cryptoEnabled = false,
  cryptoWalletConfig,
}: UpgradePageClientProps) {
  const router = useRouter();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(
    // Default to Stripe if available, otherwise HesabPay
    stripeEnabled && stripePriceInfo ? "stripe" : "hesabpay"
  );
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");
  const [cryptoNetwork, setCryptoNetwork] = useState<CryptoNetwork>("trc20");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get pricing based on selected interval
  const getMonthlyPrice = () =>
    parseFloat(subscription.proPlanPriceAfn || "1100");
  const getYearlyPrice = () =>
    parseFloat(subscription.proPlanYearlyPriceAfn || "12000");

  // Get Stripe prices based on interval
  const getCurrentStripePrice = () =>
    billingInterval === "yearly" ? stripeYearlyPriceInfo : stripePriceInfo;

  // Get AFN price based on interval
  const getCurrentAfnPrice = () =>
    billingInterval === "yearly" ? getYearlyPrice() : getMonthlyPrice();

  const handleUpgrade = async () => {
    if (!selectedMethod) {
      setError("Please select a payment method");
      return;
    }

    // Check if yearly is selected but not available for Stripe
    if (
      selectedMethod === "stripe" &&
      billingInterval === "yearly" &&
      !stripeYearlyPriceInfo
    ) {
      setError("Yearly billing is not available for card payments");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (selectedMethod === "crypto") {
        // Handle crypto payment
        const result = await initiateProUpgradeWithCrypto(tenantId, {
          network: cryptoNetwork,
          billingInterval,
        });

        if (result.success && result.cryptoPaymentId) {
          // Redirect to crypto payment page
          router.push(
            `/dashboard/${storeSlug}/billing/crypto-payment?id=${result.cryptoPaymentId}`
          );
        } else {
          setError(result.error || "Failed to start crypto payment");
        }
      } else {
        // Handle Stripe or HesabPay
        const result = await initiateProUpgrade(tenantId, {
          useHesabPay: selectedMethod === "hesabpay",
          billingInterval,
        });

        if (result.success && result.paymentUrl) {
          // Redirect to payment page (Stripe Checkout or HesabPay)
          window.location.href = result.paymentUrl;
        } else {
          setError(result.error || "Failed to start upgrade process");
        }
      }
    } catch (_err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.push(`/dashboard/${storeSlug}/billing`);
  };

  // Stripe available and has valid price
  const stripeAvailable = stripeEnabled && stripePriceInfo?.active;

  // Check if yearly Stripe option is available
  const stripeYearlyAvailable = stripeEnabled && stripeYearlyPriceInfo?.active;

  // HesabPay always available with AFN pricing
  const hesabPayAvailable = !!subscription.proPlanPriceAfn;

  // Crypto available if enabled and at least one wallet is enabled with an address
  const cryptoAvailable =
    cryptoEnabled &&
    cryptoWalletConfig &&
    ((cryptoWalletConfig.trc20?.enabled && cryptoWalletConfig.trc20?.address) ||
      (cryptoWalletConfig.erc20?.enabled &&
        cryptoWalletConfig.erc20?.address) ||
      (cryptoWalletConfig.bep20?.enabled && cryptoWalletConfig.bep20?.address));

  // Get available networks for crypto (only those enabled with an address)
  const availableNetworks = cryptoWalletConfig
    ? (["trc20", "erc20", "bep20"] as const).filter(
        (n) => cryptoWalletConfig[n]?.enabled && cryptoWalletConfig[n]?.address
      )
    : [];

  // Check if yearly option is available (either Stripe or AFN)
  const hasYearlyOption =
    stripeYearlyAvailable ||
    parseFloat(subscription.proPlanYearlyPriceAfn || "0") > 0;

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="shrink-0"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Upgrade to Pro</h1>
          <p className="text-muted-foreground">
            Choose your preferred payment method for {storeName}
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Pro Plan Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Crown className="size-5 text-primary" />
            Kaka Malem Pro
          </CardTitle>
          <CardDescription>
            Unlock unlimited products and priority support
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Check className="size-4 text-green-600" />
              <span>Unlimited products</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-green-600" />
              <span>Priority support</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-green-600" />
              <span>All core features included</span>
            </div>
          </div>

          {/* Billing Interval Selector */}
          {hasYearlyOption && (
            <BillingIntervalSelector
              value={billingInterval}
              onChange={setBillingInterval}
              monthlyPrice={getMonthlyPrice()}
              yearlyPrice={getYearlyPrice()}
              currency="AFN"
              disabled={isLoading}
            />
          )}
        </CardContent>
      </Card>

      {/* Payment Method Selection */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Select Payment Method</h2>

        <div
          className={cn(
            "grid gap-4",
            // Dynamic grid columns based on available payment methods
            [stripeAvailable, hesabPayAvailable, cryptoAvailable].filter(
              Boolean
            ).length === 3
              ? "sm:grid-cols-3"
              : "sm:grid-cols-2"
          )}
        >
          {/* Stripe Option */}
          {stripeAvailable && (
            <button
              type="button"
              onClick={() => setSelectedMethod("stripe")}
              disabled={
                isLoading ||
                (billingInterval === "yearly" && !stripeYearlyAvailable)
              }
              className={cn(
                "relative flex flex-col items-start rounded-lg border-2 p-4 text-left transition-all hover:bg-accent/50",
                selectedMethod === "stripe"
                  ? "border-primary bg-primary/5"
                  : "border-muted",
                billingInterval === "yearly" &&
                  !stripeYearlyAvailable &&
                  "cursor-not-allowed opacity-50"
              )}
            >
              {selectedMethod === "stripe" && (
                <div className="absolute -top-2.5 right-3">
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                    Selected
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 w-full">
                <div className="flex size-10 items-center justify-center rounded-md bg-[#635BFF]/10">
                  <CreditCard className="size-5 text-[#635BFF]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Card Payment</h3>
                  <p className="text-xs text-muted-foreground">
                    Visa, Mastercard, and more
                  </p>
                </div>
              </div>

              <div className="mt-4 w-full">
                {getCurrentStripePrice() ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">
                      {getCurrentStripePrice()!.currency === "USD" ? "$" : ""}
                      {formatPrice(getCurrentStripePrice()!.amount)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {getCurrentStripePrice()!.currency !== "USD" &&
                        getCurrentStripePrice()!.currency}{" "}
                      / {billingInterval === "yearly" ? "year" : "month"}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {billingInterval === "yearly"
                      ? "Yearly not available"
                      : "Price not available"}
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Shield className="size-3" />
                <span>Secure payment via Stripe</span>
              </div>
            </button>
          )}

          {/* HesabPay Option */}
          {hesabPayAvailable && (
            <button
              type="button"
              onClick={() => setSelectedMethod("hesabpay")}
              disabled={isLoading}
              className={cn(
                "relative flex flex-col items-start rounded-lg border-2 p-4 text-left transition-all hover:bg-accent/50",
                selectedMethod === "hesabpay"
                  ? "border-primary bg-primary/5"
                  : "border-muted"
              )}
            >
              {selectedMethod === "hesabpay" && (
                <div className="absolute -top-2.5 right-3">
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                    Selected
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 w-full">
                <div className="flex size-10 items-center justify-center rounded-md bg-emerald-500/10">
                  <Building2 className="size-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">HesabPay</h3>
                  <p className="text-xs text-muted-foreground">
                    Local payment (Afghanistan)
                  </p>
                </div>
              </div>

              <div className="mt-4 w-full">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">
                    {formatPrice(getCurrentAfnPrice())}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    AFN / {billingInterval === "yearly" ? "year" : "month"}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Shield className="size-3" />
                <span>Secure local payment</span>
              </div>
            </button>
          )}

          {/* USDT Crypto Option */}
          {cryptoAvailable && (
            <button
              type="button"
              onClick={() => setSelectedMethod("crypto")}
              disabled={isLoading}
              className={cn(
                "relative flex flex-col items-start rounded-lg border-2 p-4 text-left transition-all hover:bg-accent/50",
                selectedMethod === "crypto"
                  ? "border-primary bg-primary/5"
                  : "border-muted"
              )}
            >
              {selectedMethod === "crypto" && (
                <div className="absolute -top-2.5 right-3">
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                    Selected
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 w-full">
                <div className="flex size-10 items-center justify-center rounded-md bg-amber-500/10">
                  <Wallet className="size-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">USDT</h3>
                  <p className="text-xs text-muted-foreground">
                    Crypto payment (Tether)
                  </p>
                </div>
              </div>

              <div className="mt-4 w-full">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">
                    $
                    {billingInterval === "yearly"
                      ? USDT_YEARLY_PRICE
                      : USDT_MONTHLY_PRICE}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    USDT / {billingInterval === "yearly" ? "year" : "month"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ≈ {formatPrice(getCurrentAfnPrice())} AFN
                </p>
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Shield className="size-3" />
                <span>Low network fees</span>
              </div>
            </button>
          )}
        </div>

        {/* Network selector - shown below cards when crypto is selected */}
        {selectedMethod === "crypto" && availableNetworks.length > 1 && (
          <div className="rounded-lg border p-4">
            <label className="text-sm font-medium">Select Network</label>
            <Select
              value={cryptoNetwork}
              onValueChange={(v) => setCryptoNetwork(v as CryptoNetwork)}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select network" />
              </SelectTrigger>
              <SelectContent>
                {availableNetworks.includes("trc20") && (
                  <SelectItem value="trc20">
                    TRC20 (Tron) - Low fees ~$1
                  </SelectItem>
                )}
                {availableNetworks.includes("bep20") && (
                  <SelectItem value="bep20">
                    BEP20 (BSC) - Low fees ~$0.50
                  </SelectItem>
                )}
                {availableNetworks.includes("erc20") && (
                  <SelectItem value="erc20">
                    ERC20 (Ethereum) - Higher fees ~$5+
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              Choose the network you&apos;ll use to send USDT. TRC20 is
              recommended for lowest fees.
            </p>
          </div>
        )}

        {/* No payment methods available */}
        {!stripeAvailable && !hesabPayAvailable && !cryptoAvailable && (
          <div className="rounded-md border border-amber-500/50 bg-amber-50 p-4 text-sm text-amber-900">
            No payment methods are currently available. Please contact support.
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={handleBack} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleUpgrade}
          disabled={isLoading || !selectedMethod}
          className="gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Crown className="size-4" />
              Continue to Payment
            </>
          )}
        </Button>
      </div>

      {/* Trust Badges */}
      <div className="flex flex-wrap items-center justify-center gap-4 border-t pt-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Shield className="size-4" />
          <span>Secure checkout</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Check className="size-4" />
          <span>Cancel anytime</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CreditCard className="size-4" />
          <span>Encrypted payment</span>
        </div>
      </div>
    </div>
  );
}
