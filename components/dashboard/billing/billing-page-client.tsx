"use client";

import { BillingStatusCard } from "./billing-status-card";
import { TransactionList } from "./transaction-list";
import type {
  BillingOverview,
  CommissionTransactionItem,
  TransactionPagination,
} from "@/lib/db/queries/billing";

interface BillingPageClientProps {
  storeSlug: string;
  currency: string;
  billing: BillingOverview;
  transactions: CommissionTransactionItem[];
  pagination: TransactionPagination;
}

export function BillingPageClient({
  storeSlug,
  currency,
  billing,
  transactions,
  pagination,
}: BillingPageClientProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          Manage your store&apos;s billing and commission fees
        </p>
      </div>

      {/* Billing Status Card */}
      <BillingStatusCard billing={billing} currency={currency} />

      {/* Transaction History */}
      <TransactionList
        transactions={transactions}
        pagination={pagination}
        storeSlug={storeSlug}
        currency={currency}
      />
    </div>
  );
}
