"use client";

import { BillingStatusCard } from "./billing-status-card";
import { PlanComparison } from "./plan-comparison";
import { InvoiceList } from "./invoice-list";
import type {
  SubscriptionOverview,
  InvoiceWithStats,
} from "@/lib/db/queries/billing";

interface BillingPageClientProps {
  storeSlug: string;
  storeName: string;
  currency: string;
  subscription: SubscriptionOverview;
  invoices: InvoiceWithStats[];
  invoicesTotal: number;
}

export function BillingPageClient({
  currency,
  subscription,
  invoices,
  invoicesTotal,
}: BillingPageClientProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and view your billing history
        </p>
      </div>

      {/* Subscription Status Card */}
      <BillingStatusCard subscription={subscription} currency={currency} />

      {/* Plan Comparison - only show for non-Pro users */}
      {subscription.plan !== "pro" && (
        <PlanComparison subscription={subscription} currency={currency} />
      )}

      {/* Billing History (Invoices) */}
      <InvoiceList
        invoices={invoices}
        total={invoicesTotal}
        currency={currency}
      />
    </div>
  );
}
