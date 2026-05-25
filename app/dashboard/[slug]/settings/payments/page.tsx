import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getUserStoreContext } from "@/lib/auth/context";
import { canAccessSettingsPage } from "@/lib/config/settings-permissions";
import { AccessDenied } from "@/components/access-denied";
import { getAllPaymentGatewayConfigs } from "@/lib/actions/payments";
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

  const userContext = await getUserStoreContext(store.id);
  if (!userContext || !canAccessSettingsPage(userContext, "payments")) {
    return (
      <AccessDenied
        message="You need owner access to configure payment settings."
        backUrl={`/dashboard/${slug}/settings`}
        backLabel="Back to Settings"
      />
    );
  }

  const gatewayConfigs = await getAllPaymentGatewayConfigs(store.id);
  const configMap = new Map(gatewayConfigs.map((c) => [c.gateway, c]));

  return (
    <PaymentSettingsForm
      storeId={store.id}
      storeCurrency={store.currency}
      initialConfigs={{
        hesabpay: configMap.get("hesabpay") || null,
        cod: configMap.get("cod") || null,
      }}
    />
  );
}
