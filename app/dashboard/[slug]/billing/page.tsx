import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import {
  getBillingOverview,
  getCommissionTransactions,
} from "@/lib/db/queries/billing";
import { BillingPageClient } from "@/components/dashboard/billing/billing-page-client";

interface BillingPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
  }>;
}

export default async function BillingPage({
  params,
  searchParams,
}: BillingPageProps) {
  const { slug } = await params;
  const search = await searchParams;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  // Parse pagination
  const page = parseInt(search.page || "1");

  // Fetch billing data in parallel
  const [billingOverview, transactionsResult] = await Promise.all([
    getBillingOverview(store.id),
    getCommissionTransactions(store.id, { page, limit: 25 }),
  ]);

  if (!billingOverview) {
    notFound();
  }

  return (
    <BillingPageClient
      storeSlug={slug}
      currency={store.currency}
      billing={billingOverview}
      transactions={transactionsResult.transactions}
      pagination={transactionsResult.pagination}
    />
  );
}
