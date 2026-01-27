import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getUserStoreContext } from "@/lib/auth/context";
import { canAccessSettingsPage } from "@/lib/config/settings-permissions";
import { AccessDenied } from "@/components/access-denied";
import { getPendingTransferRequest } from "@/lib/db/queries/store-transfers";
import { DangerZoneSettings } from "./danger-zone-settings";
import { TransferOwnership } from "./transfer-ownership";

interface DangerSettingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function DangerSettingsPage({
  params,
}: DangerSettingsPageProps) {
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
  if (!userContext || !canAccessSettingsPage(userContext.role, "danger")) {
    return (
      <AccessDenied
        message="Only the store owner can access danger zone settings."
        backUrl={`/dashboard/${slug}/settings`}
        backLabel="Back to Settings"
      />
    );
  }

  // Get pending transfer if any
  const pendingTransfer = await getPendingTransferRequest(store.id);

  return (
    <div className="space-y-6">
      <TransferOwnership
        storeId={store.id}
        storeName={store.name}
        pendingTransfer={
          pendingTransfer
            ? {
                id: pendingTransfer.id,
                toUser: pendingTransfer.toUser,
                expiresAt: pendingTransfer.expiresAt,
                createdAt: pendingTransfer.createdAt,
                message: pendingTransfer.message,
              }
            : null
        }
      />
      <DangerZoneSettings
        storeId={store.id}
        storeName={store.name}
        storeSlug={store.slug}
        isActive={store.status === "active"}
      />
    </div>
  );
}
