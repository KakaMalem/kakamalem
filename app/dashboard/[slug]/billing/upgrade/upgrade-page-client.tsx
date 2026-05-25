"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  Loader2,
  Crown,
  Check,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { initiateProUpgrade } from "@/lib/actions/subscriptions";
import { BillingIntervalSelector } from "@/components/dashboard/billing/billing-interval-selector";
import type { SubscriptionOverview } from "@/lib/db/queries/billing";
import type { BillingInterval } from "@/lib/db/schema";

interface UpgradePageClientProps {
  tenantId: string;
  storeSlug: string;
  storeName: string;
  subscription: SubscriptionOverview;
}

function formatPrice(price: string | number): string {
  const value = typeof price === "string" ? parseFloat(price) : price;
  return value.toLocaleString();
}

export function UpgradePageClient({
  tenantId,
  storeSlug,
  storeName,
  subscription,
}: UpgradePageClientProps) {
  const router = useRouter();
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getMonthlyPrice = () =>
    parseFloat(subscription.proPlanPriceAfn || "1100");
  const getYearlyPrice = () =>
    parseFloat(subscription.proPlanYearlyPriceAfn || "12000");

  const getCurrentPrice = () =>
    billingInterval === "yearly" ? getYearlyPrice() : getMonthlyPrice();

  const hasYearlyOption =
    parseFloat(subscription.proPlanYearlyPriceAfn || "0") > 0;

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await initiateProUpgrade(tenantId, { billingInterval });

      if (result.success && result.paymentUrl) {
        window.location.href = result.paymentUrl;
      } else if (result.success && result.reactivated) {
        router.push(`/dashboard/${storeSlug}/billing?payment=success`);
      } else {
        setError(result.error || "Failed to start upgrade process");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.push(`/dashboard/${storeSlug}/billing`);
  };

  return (
    <div className="space-y-6">
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
            Continue with HesabPay to subscribe {storeName}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

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

          <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-emerald-500/10">
                <CreditCard className="size-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Pay with HesabPay</h3>
                <p className="text-xs text-muted-foreground">
                  You&apos;ll be redirected to HesabPay&apos;s secure checkout
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-baseline gap-1 justify-end">
                  <span className="text-2xl font-bold">
                    {formatPrice(getCurrentPrice())}
                  </span>
                  <span className="text-sm text-muted-foreground">AFN</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  per {billingInterval === "yearly" ? "year" : "month"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={handleBack} disabled={isLoading}>
          Cancel
        </Button>
        <Button onClick={handleUpgrade} disabled={isLoading} className="gap-2">
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
