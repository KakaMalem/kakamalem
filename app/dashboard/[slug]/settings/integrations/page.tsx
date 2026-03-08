import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getUserStoreContext } from "@/lib/auth/context";
import { canAccessSettingsPage } from "@/lib/config/settings-permissions";
import { AccessDenied } from "@/components/access-denied";
import { IntegrationsForm } from "./integrations-form";

interface IntegrationsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function IntegrationsSettingsPage({
  params,
}: IntegrationsPageProps) {
  const { slug } = await params;
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const store = await getTenantBySlug(slug);

  if (!store) {
    notFound();
  }

  // Role-based access check (requires admin or owner for certain parts, but integrations are often owner only)
  const userContext = await getUserStoreContext(store.id);
  if (
    !userContext ||
    !canAccessSettingsPage(userContext.role, "integrations")
  ) {
    return (
      <AccessDenied
        message="Only store owners can manage external platform integrations."
        backUrl={`/dashboard/${slug}/settings`}
        backLabel="Back to Settings"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Integrations</h2>
        <p className="text-muted-foreground text-sm">
          Connect your store to external platforms and automate your
          dropshipping workflow.
        </p>
      </div>

      <IntegrationsForm
        tenantId={store.id}
        tenantSlug={store.slug}
        initialApiKey={store.externalApiKey || null}
      />
    </div>
  );
}
