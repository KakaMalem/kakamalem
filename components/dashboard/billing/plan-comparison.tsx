"use client";

import { Check, X, Crown, Zap, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  PlanFeature,
  SubscriptionOverview,
} from "@/lib/db/queries/billing";

interface PlanComparisonProps {
  subscription: SubscriptionOverview;
  planFeatures: PlanFeature[];
  currency: string;
}

function formatPrice(price: string | number): string {
  const value = typeof price === "string" ? parseFloat(price) : price;
  return value.toLocaleString();
}

function FeatureValue({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="size-4 text-green-600" />
    ) : (
      <X className="size-4 text-muted-foreground/40" />
    );
  }
  return <span className="text-sm font-medium">{value}</span>;
}

export function PlanComparison({
  subscription,
  planFeatures,
  currency,
}: PlanComparisonProps) {
  const isPro = subscription.plan === "pro";
  const showUpgrade =
    !isPro &&
    (subscription.status === "trialing" ||
      subscription.status === "expired" ||
      subscription.status === "active");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5" />
          Compare Plans
        </CardTitle>
        <CardDescription>
          Choose the plan that best fits your business needs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Free Plan */}
          <div
            className={cn(
              "relative flex flex-col rounded-lg border bg-card p-6 transition-shadow",
              !isPro ? "ring-2 ring-primary shadow-sm" : "hover:shadow-sm"
            )}
          >
            {!isPro && (
              <div className="absolute -top-3 left-4">
                <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Current Plan
                </span>
              </div>
            )}

            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <Zap className="size-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">Free</h3>
                <p className="text-xs text-muted-foreground">Get started</p>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight">0</span>
                <span className="text-sm text-muted-foreground">
                  {currency}/mo
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {subscription.trialDurationDays}-day trial, then{" "}
                {subscription.freeProductLimit} products
              </p>
            </div>

            <div className="flex-1 space-y-2.5">
              {planFeatures.map((feature) => (
                <div
                  key={feature.name}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="text-muted-foreground">{feature.name}</span>
                  <FeatureValue value={feature.free} />
                </div>
              ))}
            </div>

            {!isPro && subscription.status !== "trialing" && (
              <Button variant="outline" className="mt-6 w-full" disabled>
                Current Plan
              </Button>
            )}
          </div>

          {/* Pro Plan */}
          <div
            className={cn(
              "relative flex flex-col rounded-lg border p-6 transition-shadow",
              isPro
                ? "ring-2 ring-primary bg-card shadow-sm"
                : "border-primary/20 bg-primary/2 hover:shadow-sm"
            )}
          >
            {isPro ? (
              <div className="absolute -top-3 left-4">
                <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Current Plan
                </span>
              </div>
            ) : (
              <div className="absolute -top-3 left-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  <Crown className="size-3" />
                  Recommended
                </span>
              </div>
            )}

            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Crown className="size-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Pro</h3>
                <p className="text-xs text-muted-foreground">
                  For growing businesses
                </p>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight">
                  {formatPrice(subscription.proPlanPriceAfn)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {currency}/mo
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Unlimited products & priority support
              </p>
            </div>

            <div className="flex-1 space-y-2.5">
              {planFeatures.map((feature) => (
                <div
                  key={feature.name}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="text-muted-foreground">{feature.name}</span>
                  <FeatureValue value={feature.pro} />
                </div>
              ))}
            </div>

            {showUpgrade && (
              <Button className="mt-6 w-full" asChild>
                <a
                  href={`https://wa.me/93708133894?text=${encodeURIComponent("Hi! I'd like to upgrade my Kaka Malem store to Pro plan.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Crown className="mr-2 size-4" />
                  Upgrade to Pro
                </a>
              </Button>
            )}
            {isPro && (
              <Button variant="outline" className="mt-6 w-full" disabled>
                Current Plan
              </Button>
            )}
          </div>
        </div>

        {/* Payment Info */}
        {showUpgrade && (
          <div className="mt-6 rounded-lg border bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              <strong>How to upgrade:</strong> Contact our team to upgrade your
              subscription. We accept mobile money payments (M-Paisa, My Money)
              and bank transfers.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`https://wa.me/93708133894?text=${encodeURIComponent("Hi! I'd like to upgrade my Kaka Malem store to Pro plan.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Contact via WhatsApp
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="mailto:kakamalem.team@gmail.com">Email Support</a>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
