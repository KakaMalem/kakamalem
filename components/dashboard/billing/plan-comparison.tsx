"use client";

import { useState } from "react";
import { Check, Crown, Zap, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SubscriptionOverview } from "@/lib/db/queries/billing";
import { initiateProUpgrade } from "@/lib/actions/subscriptions";

interface PlanComparisonProps {
  subscription: SubscriptionOverview;
  currency: string;
  tenantId: string;
}

function formatPrice(price: string | number): string {
  const value = typeof price === "string" ? parseFloat(price) : price;
  return value.toLocaleString();
}

// Features included in ALL plans
const INCLUDED_FEATURES = [
  "Online checkout",
  "Offline/POS sales",
  "Order management",
  "Analytics dashboard",
  "Custom branding",
  "Team members",
  "Delivery zones",
];

export function PlanComparison({
  subscription,
  currency,
  tenantId,
}: PlanComparisonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPro = subscription.plan === "pro";
  const showUpgrade =
    !isPro &&
    (subscription.status === "trialing" ||
      subscription.status === "expired" ||
      subscription.status === "active");

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await initiateProUpgrade(tenantId);

      if (result.success && result.paymentUrl) {
        // Redirect to HesabPay payment page
        window.location.href = result.paymentUrl;
      } else {
        setError(result.error || "Failed to start upgrade");
      }
    } catch (_err) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>Choose Your Plan</CardTitle>
        <CardDescription>Simple pricing. Upgrade anytime.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Error Alert */}
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Plan Cards - Stack on mobile, side by side on tablet+, constrained on desktop */}
        <div className="grid gap-3 sm:grid-cols-2 sm:max-w-xl">
          {/* Free Plan */}
          <div
            className={cn(
              "relative rounded-lg border-2 p-4 transition-all",
              !isPro
                ? "border-primary bg-primary/5"
                : "border-muted hover:border-muted-foreground/20"
            )}
          >
            {!isPro && (
              <div className="absolute -top-2.5 left-3">
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                  Current
                </span>
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                <Zap className="size-4 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Free</h3>
                <p className="text-[11px] text-muted-foreground">
                  {subscription.trialDurationDays}-day trial
                </p>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">0</span>
                <span className="text-xs text-muted-foreground">
                  {currency}/mo
                </span>
              </div>
            </div>

            <ul className="mt-3 space-y-1.5">
              <li className="flex items-center gap-1.5 text-xs">
                <Check className="size-3.5 text-green-600 shrink-0" />
                <span>Up to {subscription.freeProductLimit} products</span>
              </li>
              <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="size-3.5 text-muted-foreground/50 shrink-0" />
                <span>All core features</span>
              </li>
            </ul>

            {!isPro && subscription.status !== "trialing" && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                disabled
              >
                Current Plan
              </Button>
            )}
          </div>

          {/* Pro Plan */}
          <div
            className={cn(
              "relative rounded-lg border-2 p-4 transition-all",
              isPro
                ? "border-primary bg-primary/5"
                : "border-primary/50 bg-linear-to-b from-primary/5 to-transparent"
            )}
          >
            <div className="absolute -top-2.5 left-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                <Crown className="size-2.5" />
                {isPro ? "Current" : "Best Value"}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
                <Crown className="size-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Pro</h3>
                <p className="text-[11px] text-muted-foreground">For growth</p>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">
                  {formatPrice(subscription.proPlanPriceAfn)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {currency}/mo
                </span>
              </div>
            </div>

            <ul className="mt-3 space-y-1.5">
              <li className="flex items-center gap-1.5 text-xs font-medium">
                <Check className="size-3.5 text-green-600 shrink-0" />
                <span>Unlimited products</span>
              </li>
              <li className="flex items-center gap-1.5 text-xs">
                <Check className="size-3.5 text-green-600 shrink-0" />
                <span>Priority support</span>
              </li>
              <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="size-3.5 text-muted-foreground/50 shrink-0" />
                <span>All core features</span>
              </li>
            </ul>

            {showUpgrade && (
              <Button
                size="sm"
                className="mt-4 w-full"
                onClick={handleUpgrade}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Crown className="mr-1.5 size-3.5" />
                    Upgrade to Pro
                  </>
                )}
              </Button>
            )}
            {isPro && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                disabled
              >
                Current Plan
              </Button>
            )}
          </div>
        </div>

        {/* Included Features */}
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-medium mb-2">Included in all plans:</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {INCLUDED_FEATURES.map((feature) => (
              <span
                key={feature}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              >
                <Check className="size-3 text-green-600" />
                {feature}
              </span>
            ))}
          </div>
        </div>

        {/* Upgrade CTA - Only for non-Pro users */}
        {showUpgrade && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs">
              <span className="font-medium">Ready to upgrade?</span>{" "}
              <span className="text-muted-foreground">
                Click the button above or contact us for help.
              </span>
            </p>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                asChild
              >
                <a href="mailto:kakamalem.team@gmail.com">Need Help?</a>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
