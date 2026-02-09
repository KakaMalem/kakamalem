import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getUserStoreContext } from "@/lib/auth/context";
import { canAccessSettingsPage } from "@/lib/config/settings-permissions";
import { AccessDenied } from "@/components/access-denied";
import { getAllPaymentGatewayConfigs } from "@/lib/actions/payments";
import { isStripeEnabled } from "@/lib/stripe";
import { isCryptoEnabled } from "@/lib/payments/crypto";
import { PaymentSettingsForm } from "./payment-settings-form";

interface PaymentSettingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PaymentSettingsPage({
  params,
}: PaymentSettingsPageProps) {
  const { slug } = await params;
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const store = await getTenantBySlug(slug);

  if (!store) {
    notFound();
  }

  // Role-based access check (requires owner)
  const userContext = await getUserStoreContext(store.id);
  if (!userContext || !canAccessSettingsPage(userContext.role, "payments")) {
    return (
      <AccessDenied
        message="You need owner access to configure payment settings."
        backUrl={`/dashboard/${slug}/settings`}
        backLabel="Back to Settings"
      />
    );
  }

  // Check if Stripe and Crypto are configured at platform level
  const [stripeEnabled, cryptoEnabled, gatewayConfigs] = await Promise.all([
    Promise.resolve(isStripeEnabled()),
    isCryptoEnabled(),
    getAllPaymentGatewayConfigs(store.id),
  ]);

  // Transform to a map for easy lookup
  const configMap = new Map(gatewayConfigs.map((c) => [c.gateway, c]));

  return (
    <PaymentSettingsForm
      storeId={store.id}
      stripeEnabled={stripeEnabled}
      cryptoEnabled={cryptoEnabled}
      initialConfigs={{
        hesabpay: configMap.get("hesabpay") || null,
        stripe: configMap.get("stripe") || null,
        cod: configMap.get("cod") || null,
        crypto_usdt: configMap.get("crypto_usdt") || null,
      }}
    />
  );
}
