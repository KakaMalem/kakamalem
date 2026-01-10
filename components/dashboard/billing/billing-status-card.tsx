"use client";

import {
  Gift,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Percent,
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
import type { BillingOverview } from "@/lib/db/queries/billing";
import type { BillingStatus } from "@/lib/db/schema";

interface BillingStatusCardProps {
  billing: BillingOverview;
  currency: string;
}

const STATUS_CONFIG: Record<
  BillingStatus,
  {
    label: string;
    icon: typeof Gift;
    badgeVariant: "default" | "secondary" | "destructive" | "outline";
    bgColor: string;
    iconColor: string;
  }
> = {
  free_tier: {
    label: "Free Tier",
    icon: Gift,
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
  grace_period: {
    label: "Grace Period",
    icon: AlertTriangle,
    badgeVariant: "outline",
    bgColor: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  suspended: {
    label: "Suspended",
    icon: XCircle,
    badgeVariant: "destructive",
    bgColor: "bg-red-50",
    iconColor: "text-red-600",
  },
  forgiven: {
    label: "Forgiven",
    icon: Clock,
    badgeVariant: "secondary",
    bgColor: "bg-gray-50",
    iconColor: "text-gray-600",
  },
};

function formatPrice(price: string | number, currency: string): string {
  const value = typeof price === "string" ? parseFloat(price) : price;
  return `${value.toLocaleString()} ${currency}`;
}

export function BillingStatusCard({
  billing,
  currency,
}: BillingStatusCardProps) {
  const config = STATUS_CONFIG[billing.billingStatus];
  const StatusIcon = config.icon;

  const balance = parseFloat(billing.commissionBalance);
  const limit = parseFloat(billing.freeTierLimit);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Billing Status</CardTitle>
          <Badge variant={config.badgeVariant}>{config.label}</Badge>
        </div>
        <CardDescription>
          Your current billing status and commission information
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
            {billing.billingStatus === "free_tier" && (
              <>
                <p className="font-medium">You&apos;re on the free tier</p>
                <p className="text-sm text-muted-foreground">
                  First {formatPrice(limit, currency)} in commissions is free.
                  You&apos;ve used {formatPrice(balance, currency)} so far.
                </p>
              </>
            )}
            {billing.billingStatus === "active" && (
              <>
                <p className="font-medium">Your account is in good standing</p>
                <p className="text-sm text-muted-foreground">
                  All commission payments are up to date.
                </p>
              </>
            )}
            {billing.billingStatus === "grace_period" && (
              <>
                <p className="font-medium">Grace period active</p>
                <p className="text-sm text-muted-foreground">
                  You have exceeded the free tier limit.{" "}
                  {billing.daysUntilGracePeriodEnds !== null && (
                    <span
                      className={cn(
                        "font-medium",
                        billing.daysUntilGracePeriodEnds <= 7 &&
                          "text-amber-700",
                        billing.daysUntilGracePeriodEnds <= 3 && "text-red-700"
                      )}
                    >
                      {billing.daysUntilGracePeriodEnds} days remaining
                    </span>
                  )}{" "}
                  to make a payment.
                </p>
              </>
            )}
            {billing.billingStatus === "suspended" && (
              <>
                <p className="font-medium">Store suspended</p>
                <p className="text-sm text-muted-foreground">
                  Your store is suspended due to unpaid commissions. Contact
                  support to arrange payment.
                </p>
              </>
            )}
            {billing.billingStatus === "forgiven" && (
              <>
                <p className="font-medium">Previous balance forgiven</p>
                <p className="text-sm text-muted-foreground">
                  Your previous balance was forgiven. The store is currently
                  inactive but can be reactivated.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Free Tier Progress Bar */}
        {billing.billingStatus === "free_tier" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Free tier usage</span>
              <span className="font-medium">
                {billing.freeTierUsedPercent}%
              </span>
            </div>
            <Progress
              value={billing.freeTierUsedPercent}
              className={cn(
                "h-2",
                billing.freeTierUsedPercent >= 90 && "[&>div]:bg-red-500",
                billing.freeTierUsedPercent >= 75 &&
                  billing.freeTierUsedPercent < 90 &&
                  "[&>div]:bg-amber-500"
              )}
            />
            <p className="text-xs text-muted-foreground">
              {formatPrice(balance, currency)} of {formatPrice(limit, currency)}{" "}
              commission used
            </p>
          </div>
        )}

        {/* Balance and Rate Summary */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Commission Balance</span>
            </div>
            <p className="mt-1 text-2xl font-bold">
              {formatPrice(balance, currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              {balance > 0
                ? "Amount owed to platform"
                : "No outstanding balance"}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Percent className="size-4" />
              <span>Commission Rate</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{billing.commissionRate}%</p>
            <p className="text-xs text-muted-foreground">
              Applied to all orders
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
