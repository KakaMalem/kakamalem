import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getSubscriptionOverview, getInvoices } from "@/lib/db/queries/billing";
import { BillingPageClient } from "@/components/dashboard/billing/billing-page-client";

interface BillingPageProps {
  params: Promise<{ slug: string }>;
}

export default async function BillingPage({ params }: BillingPageProps) {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  // Fetch billing data in parallel
  const [subscription, invoicesData] = await Promise.all([
    getSubscriptionOverview(store.id),
    getInvoices(store.id, { limit: 20 }),
  ]);

  if (!subscription) {
    notFound();
  }

  return (
    <BillingPageClient
      storeSlug={slug}
      storeName={store.name}
      currency={store.currency}
      subscription={subscription}
      invoices={invoicesData.invoices}
      invoicesTotal={invoicesData.total}
    />
  );
}
