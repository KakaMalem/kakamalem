import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { canManageStore } from "@/lib/auth/context";
import {
  getBalanceSummary,
  getSellerTransactions,
  getSellerTransactionCount,
  getSellerPayoutMethods,
  getSellerPayouts,
  getSellerPayoutCount,
} from "@/lib/db/queries/earnings";
import { EarningsPageClient } from "@/components/dashboard/earnings/earnings-page-client";

interface EarningsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function EarningsPage({ params }: EarningsPageProps) {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  // Check permission
  const canManage = await canManageStore(store.id);
  if (!canManage) {
    notFound();
  }

  // Fetch earnings data in parallel
  const [
    balance,
    transactions,
    transactionCount,
    payoutMethods,
    payouts,
    payoutCount,
  ] = await Promise.all([
    getBalanceSummary(store.id),
    getSellerTransactions(store.id, { limit: 10 }),
    getSellerTransactionCount(store.id),
    getSellerPayoutMethods(store.id),
    getSellerPayouts(store.id, { limit: 10 }),
    getSellerPayoutCount(store.id),
  ]);

  return (
    <EarningsPageClient
      tenantId={store.id}
      storeSlug={slug}
      storeName={store.name}
      currency={store.currency}
      balance={balance}
      transactions={transactions}
      transactionCount={transactionCount}
      payoutMethods={payoutMethods}
      payouts={payouts}
      payoutCount={payoutCount}
    />
  );
}
