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
import { Badge } from "@/components/ui/badge";
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

function formatPrice(price: string | number, currency: string): string {
  const value = typeof price === "string" ? parseFloat(price) : price;
  return `${value.toLocaleString()} ${currency}`;
}

function FeatureValue({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="size-5 text-green-600" />
    ) : (
      <X className="size-5 text-muted-foreground/50" />
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
        {/* Plan Cards */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Free Plan */}
          <div
            className={cn(
              "relative rounded-xl border-2 p-6",
              !isPro ? "border-primary bg-primary/5" : "border-border"
            )}
          >
            {!isPro && (
              <Badge className="absolute -top-3 right-4" variant="default">
                Current Plan
              </Badge>
            )}
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <Zap className="size-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Free</h3>
                <p className="text-sm text-muted-foreground">
                  Perfect for getting started
                </p>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold">0</span>
              <span className="text-muted-foreground"> {currency}/month</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {subscription.trialDurationDays}-day trial with full access, then
              limited to {subscription.freeProductLimit} products
            </p>
            <ul className="mt-6 space-y-3">
              {planFeatures.map((feature) => (
                <li
                  key={feature.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">{feature.name}</span>
                  <FeatureValue value={feature.free} />
                </li>
              ))}
            </ul>
            {!isPro && subscription.status !== "trialing" && (
              <Button variant="outline" className="mt-6 w-full" disabled>
                Current Plan
              </Button>
            )}
          </div>

          {/* Pro Plan */}
          <div
            className={cn(
              "relative rounded-xl border-2 p-6",
              isPro
                ? "border-primary bg-primary/5"
                : "border-amber-200 bg-amber-50"
            )}
          >
            {isPro ? (
              <Badge className="absolute -top-3 right-4" variant="default">
                Current Plan
              </Badge>
            ) : (
              <Badge
                className="absolute -top-3 right-4 bg-amber-500 hover:bg-amber-600"
                variant="default"
              >
                Recommended
              </Badge>
            )}
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-100">
                <Crown className="size-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Pro</h3>
                <p className="text-sm text-muted-foreground">
                  For growing businesses
                </p>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold">
                {
                  formatPrice(subscription.proPlanPriceAfn, currency).split(
                    " "
                  )[0]
                }
              </span>
              <span className="text-muted-foreground"> {currency}/month</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Unlimited products and priority support for serious sellers
            </p>
            <ul className="mt-6 space-y-3">
              {planFeatures.map((feature) => (
                <li
                  key={feature.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">{feature.name}</span>
                  <FeatureValue value={feature.pro} />
                </li>
              ))}
            </ul>
            {showUpgrade && (
              <Button
                className="mt-6 w-full bg-amber-500 hover:bg-amber-600"
                asChild
              >
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
