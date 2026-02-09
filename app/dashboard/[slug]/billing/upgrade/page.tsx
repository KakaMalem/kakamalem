import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/server";
import { canManageStore } from "@/lib/auth/context";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getSubscriptionOverview } from "@/lib/db/queries/billing";
import { getPlatformSettings } from "@/lib/db/queries/admin";
import { isStripeEnabled, getProPricingInfo } from "@/lib/stripe";
import { UpgradePageClient } from "./upgrade-page-client";

// =============================================================================
// PRO UPGRADE PAGE
// =============================================================================
// Payment method selection for upgrading to Pro plan
// =============================================================================

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BillingUpgradePage({ params }: PageProps) {
  const { slug } = await params;

  // Auth check
  await requireAuth();

  // Get tenant
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    redirect("/dashboard");
  }

  // Permission check
  const canManage = await canManageStore(tenant.id);
  if (!canManage) {
    redirect("/dashboard");
  }

  // Get subscription overview
  const subscription = await getSubscriptionOverview(tenant.id);
  if (!subscription) {
    redirect(`/dashboard/${slug}/billing`);
  }

  // Already Pro? Redirect back to billing
  if (subscription.plan === "pro" && subscription.status === "active") {
    redirect(`/dashboard/${slug}/billing`);
  }

  // Check available payment methods
  const stripeEnabled = isStripeEnabled();
  const stripePricing = stripeEnabled ? await getProPricingInfo() : null;

  // Get platform settings for crypto configuration
  const platformSettings = await getPlatformSettings();
  const cryptoWalletConfig = platformSettings.usdtWalletConfig as {
    trc20?: string;
    erc20?: string;
    bep20?: string;
  } | null;
  const cryptoEnabled =
    !!cryptoWalletConfig &&
    (!!cryptoWalletConfig.trc20 ||
      !!cryptoWalletConfig.erc20 ||
      !!cryptoWalletConfig.bep20);

  // If no payment methods are available (shouldn't happen), redirect back
  if (!stripeEnabled && !subscription.proPlanPriceAfn && !cryptoEnabled) {
    redirect(`/dashboard/${slug}/billing`);
  }

  return (
    <UpgradePageClient
      tenantId={tenant.id}
      storeSlug={slug}
      storeName={tenant.name}
      subscription={subscription}
      stripeEnabled={stripeEnabled}
      stripePriceInfo={stripePricing?.monthly ?? null}
      stripeYearlyPriceInfo={stripePricing?.yearly ?? null}
      cryptoEnabled={cryptoEnabled}
      cryptoWalletConfig={cryptoWalletConfig}
    />
  );
}
