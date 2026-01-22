import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getPushNotificationStatus } from "@/lib/actions/push-notifications";
import { NotificationSettings } from "@/components/dashboard/settings/notification-settings";

interface NotificationsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function NotificationsPage({
  params,
}: NotificationsPageProps) {
  const { slug } = await params;
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const store = await getTenantBySlug(slug);

  if (!store) {
    notFound();
  }

  // Verify ownership
  if (store.ownerId !== user.id) {
    notFound();
  }

  // Get current notification status
  const { enabled, deviceCount } = await getPushNotificationStatus(store.id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Configure how you receive order alerts and other notifications
        </p>
      </div>

      <NotificationSettings
        tenantId={store.id}
        storeSlug={slug}
        initialEnabled={enabled}
        deviceCount={deviceCount}
      />
    </div>
  );
}
