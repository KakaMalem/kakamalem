"use client";

import { BillingStatusCard } from "./billing-status-card";
import { PlanComparison } from "./plan-comparison";
import type {
  SubscriptionOverview,
  PlanFeature,
} from "@/lib/db/queries/billing";

interface BillingPageClientProps {
  storeSlug: string;
  storeName: string;
  currency: string;
  subscription: SubscriptionOverview;
  planFeatures: PlanFeature[];
}

export function BillingPageClient({
  currency,
  subscription,
  planFeatures,
}: BillingPageClientProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and view your plan details
        </p>
      </div>

      {/* Subscription Status Card */}
      <BillingStatusCard subscription={subscription} currency={currency} />

      {/* Plan Comparison */}
      <PlanComparison
        subscription={subscription}
        planFeatures={planFeatures}
        currency={currency}
      />
    </div>
  );
}
