import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import {
  getSubscriptionOverview,
  getPlanFeatures,
} from "@/lib/db/queries/billing";
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

  const subscription = await getSubscriptionOverview(store.id);
  if (!subscription) {
    notFound();
  }

  const planFeatures = getPlanFeatures(subscription.freeProductLimit);

  return (
    <BillingPageClient
      storeSlug={slug}
      storeName={store.name}
      currency={store.currency}
      subscription={subscription}
      planFeatures={planFeatures}
    />
  );
}
