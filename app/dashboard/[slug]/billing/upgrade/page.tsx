import { notFound, redirect } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getSubscriptionOverview } from "@/lib/db/queries/billing";
import { UpgradePageClient } from "./upgrade-page-client";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BillingUpgradePage({ params }: PageProps) {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const subscription = await getSubscriptionOverview(store.id);
  if (!subscription) {
    notFound();
  }

  // Already on active Pro — bounce back to billing
  if (subscription.plan === "pro" && subscription.status === "active") {
    redirect(`/dashboard/${slug}/billing`);
  }

  return (
    <UpgradePageClient
      tenantId={store.id}
      storeSlug={slug}
      storeName={store.name}
      subscription={subscription}
    />
  );
}
