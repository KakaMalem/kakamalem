"use client";

import {
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Crown,
  Package,
  Calendar,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { SubscriptionOverview } from "@/lib/db/queries/billing";
import type { SubscriptionStatus } from "@/lib/db/schema";

interface BillingStatusCardProps {
  subscription: SubscriptionOverview;
  currency: string;
}

const STATUS_CONFIG: Record<
  SubscriptionStatus,
  {
    label: string;
    icon: typeof Clock;
    badgeVariant: "default" | "secondary" | "destructive" | "outline";
    bgColor: string;
    iconColor: string;
  }
> = {
  trialing: {
    label: "Trial",
    icon: Clock,
    badgeVariant: "secondary",
    bgColor: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  active: {
    label: "Active",
    icon: CheckCircle,
    badgeVariant: "default",
    bgColor: "bg-green-50",
    iconColor: "text-green-600",
  },
  past_due: {
    label: "Past Due",
    icon: AlertTriangle,
    badgeVariant: "outline",
    bgColor: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    badgeVariant: "secondary",
    bgColor: "bg-gray-50",
    iconColor: "text-gray-600",
  },
  expired: {
    label: "Expired",
    icon: XCircle,
    badgeVariant: "destructive",
    bgColor: "bg-red-50",
    iconColor: "text-red-600",
  },
};

function formatPrice(price: string | number, currency: string): string {
  const value = typeof price === "string" ? parseFloat(price) : price;
  return `${value.toLocaleString()} ${currency}`;
}

export function BillingStatusCard({
  subscription,
  currency,
}: BillingStatusCardProps) {
  const config = STATUS_CONFIG[subscription.status];
  const StatusIcon = config.icon;
  const isPro = subscription.plan === "pro";
  const isYearly = subscription.billingInterval === "yearly";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {isPro && <Crown className="size-5 text-primary" />}
            Current Plan
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isPro ? "default" : "secondary"}>
              {isPro ? "Pro" : "Free"}
            </Badge>
            <Badge variant={config.badgeVariant}>{config.label}</Badge>
          </div>
        </div>
        <CardDescription>
          Your store&apos;s subscription status and usage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Display */}
        <div
          className={cn(
            "flex items-start gap-4 rounded-lg p-4",
            config.bgColor
          )}
        >
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm",
              config.iconColor
            )}
          >
            <StatusIcon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            {subscription.status === "trialing" && (
              <>
                <p className="font-medium">
                  {subscription.daysRemainingInTrial !== null &&
                  subscription.daysRemainingInTrial > 0 ? (
                    <>
                      {subscription.daysRemainingInTrial} day
                      {subscription.daysRemainingInTrial !== 1 ? "s" : ""}{" "}
                      remaining in your trial
                    </>
                  ) : (
                    "Your trial is ending soon"
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  You have full access to all features during your{" "}
                  {subscription.trialDurationDays}-day trial. Upgrade to Pro
                  before it ends to continue using your store.
                </p>
              </>
            )}
            {subscription.status === "active" && isPro && (
              <>
                <p className="font-medium">Your Pro subscription is active</p>
                <p className="text-sm text-muted-foreground">
                  You have unlimited products and access to all premium
                  features.
                  {subscription.daysRemainingInPeriod !== null && (
                    <span>
                      {" "}
                      {subscription.daysRemainingInPeriod} days until renewal.
                    </span>
                  )}
                </p>
              </>
            )}
            {subscription.status === "active" && !isPro && (
              <>
                <p className="font-medium">Your free plan is active</p>
                <p className="text-sm text-muted-foreground">
                  You&apos;re on the free plan with up to{" "}
                  {subscription.freeProductLimit} products. Upgrade to Pro for
                  unlimited products.
                </p>
              </>
            )}
            {subscription.status === "past_due" && (
              <>
                <p className="font-medium">Payment issue</p>
                <p className="text-sm text-muted-foreground">
                  There was a problem processing your payment. Please update
                  your payment method to continue using Pro features.
                </p>
              </>
            )}
            {subscription.status === "cancelled" && (
              <>
                <p className="font-medium">Subscription cancelled</p>
                <p className="text-sm text-muted-foreground">
                  Your subscription has been cancelled.
                  {subscription.daysRemainingInPeriod !== null &&
                    subscription.daysRemainingInPeriod > 0 && (
                      <span>
                        {" "}
                        You still have access until the end of your billing
                        period ({subscription.daysRemainingInPeriod} days).
                      </span>
                    )}
                </p>
              </>
            )}
            {subscription.status === "expired" && (
              <>
                <p className="font-medium">Trial expired</p>
                <p className="text-sm text-muted-foreground">
                  Your trial has ended. Upgrade to Pro to continue using your
                  store and access all features.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Price */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isPro ? (
                <Crown className="size-4 text-primary" />
              ) : (
                <Package className="size-4" />
              )}
              <span>
                {isPro && isYearly ? "Yearly Price" : "Monthly Price"}
              </span>
            </div>
            <p className="mt-1 text-2xl font-bold">
              {isPro
                ? subscription.hasStripeSubscription
                  ? formatPrice(
                      isYearly
                        ? (subscription.stripeYearlyPriceInfo?.amount ??
                            subscription.proPlanYearlyPriceAfn)
                        : (subscription.stripePriceInfo?.amount ??
                            subscription.proPlanPriceAfn),
                      isYearly
                        ? (subscription.stripeYearlyPriceInfo?.currency.toUpperCase() ??
                            currency)
                        : (subscription.stripePriceInfo?.currency.toUpperCase() ??
                            currency)
                    )
                  : formatPrice(
                      isYearly
                        ? subscription.proPlanYearlyPriceAfn
                        : subscription.proPlanPriceAfn,
                      currency
                    )
                : "0"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPro ? (isYearly ? "per year" : "per month") : "Free plan"}
            </p>
          </div>

          {/* Product Usage */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="size-4" />
              <span>Products</span>
            </div>
            <p className="mt-1 text-2xl font-bold">
              {subscription.productLimit !== null
                ? `${subscription.productCount}/${subscription.productLimit}`
                : subscription.productCount}
            </p>
            {subscription.productLimit !== null ? (
              <>
                <Progress
                  value={
                    (subscription.productCount / subscription.productLimit) *
                    100
                  }
                  className={cn(
                    "mt-2 h-1.5",
                    subscription.productLimitReached && "[&>div]:bg-red-500",
                    subscription.productCount / subscription.productLimit >=
                      0.8 &&
                      !subscription.productLimitReached &&
                      "[&>div]:bg-amber-500"
                  )}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {subscription.productLimitReached
                    ? "Limit reached"
                    : `${subscription.productLimit - subscription.productCount} remaining`}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Unlimited</p>
            )}
          </div>

          {/* Next Billing / Trial End */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="size-4" />
              <span>
                {subscription.status === "trialing"
                  ? "Trial Ends"
                  : "Next Billing"}
              </span>
            </div>
            {subscription.status === "trialing" &&
            subscription.daysRemainingInTrial !== null ? (
              <>
                <p className="mt-1 text-2xl font-bold">
                  {subscription.daysRemainingInTrial}d
                </p>
                <p className="text-xs text-muted-foreground">
                  {subscription.trialEndsAt
                    ? new Date(subscription.trialEndsAt).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric", year: "numeric" }
                      )
                    : "days left in trial"}
                </p>
              </>
            ) : subscription.subscriptionEndsAt ? (
              <>
                <p className="mt-1 text-2xl font-bold">
                  {new Date(subscription.subscriptionEndsAt).toLocaleDateString(
                    undefined,
                    { month: "short", day: "numeric" }
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(subscription.subscriptionEndsAt).toLocaleDateString(
                    undefined,
                    {
                      year: "numeric",
                    }
                  )}
                  {subscription.daysRemainingInPeriod !== null &&
                    ` (${subscription.daysRemainingInPeriod}d)`}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-2xl font-bold">—</p>
                <p className="text-xs text-muted-foreground">—</p>
              </>
            )}
          </div>
        </div>

        {/* Admin Note */}
        {subscription.subscriptionNotes && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-800">
              Note from administrator
            </p>
            <p className="mt-1 text-sm text-blue-700">
              {subscription.subscriptionNotes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
