"use client";

import Link from "next/link";
import { ArrowRight, Check, Crown, Zap } from "lucide-react";
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

interface PlanComparisonProps {
  subscription: SubscriptionOverview;
  currency: string;
  tenantId: string;
  storeSlug: string;
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
  tenantId: _tenantId,
  storeSlug,
}: PlanComparisonProps) {
  const isPro = subscription.plan === "pro";
  const isActivePro = isPro && subscription.status === "active";

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>Plan</CardTitle>
        <CardDescription>Your current plan details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
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

            {!isPro && (
              <div className="mt-4 rounded-md bg-muted/50 px-3 py-1.5 text-center text-xs font-medium text-muted-foreground">
                Current Plan
              </div>
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
                {isActivePro ? "Current" : "Best Value"}
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

            {isActivePro ? (
              <div className="mt-4 rounded-md bg-muted/50 px-3 py-1.5 text-center text-xs font-medium text-muted-foreground">
                Current Plan
              </div>
            ) : (
              <Button asChild className="mt-4 w-full h-9 gap-1.5" size="sm">
                <Link href={`/dashboard/${storeSlug}/billing/upgrade`}>
                  <Crown className="size-3.5" />
                  Upgrade to Pro
                  <ArrowRight className="size-3.5" />
                </Link>
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
      </CardContent>
    </Card>
  );
}
