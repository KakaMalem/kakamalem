import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getUserStoreContext } from "@/lib/auth/context";
import { canAccessSettingsPage } from "@/lib/config/settings-permissions";
import { AccessDenied } from "@/components/access-denied";
import { DomainSettings } from "./domain-settings";
import { getDomainConfig, getDnsInstructions } from "@/lib/actions/domains";

interface DomainSettingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function DomainSettingsPage({
  params,
}: DomainSettingsPageProps) {
  const { slug } = await params;
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const store = await getTenantBySlug(slug);

  if (!store) {
    notFound();
  }

  // Role-based access check (owner only)
  const userContext = await getUserStoreContext(store.id);
  if (!userContext || !canAccessSettingsPage(userContext.role, "domains")) {
    return (
      <AccessDenied
        message="Only the store owner can manage domain settings."
        backUrl={`/dashboard/${slug}/settings`}
        backLabel="Back to Settings"
      />
    );
  }

  // Fetch domain configuration
  const domainConfig = await getDomainConfig(slug);
  const dnsInstructions = await getDnsInstructions(slug);

  return (
    <DomainSettings
      storeSlug={store.slug}
      domainConfig={domainConfig}
      dnsInstructions={dnsInstructions}
    />
  );
}
