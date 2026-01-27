import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { tenantMembers, tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NotificationSettings } from "@/components/account/notification-settings";

export default async function NotificationSettingsPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user's stores for notification settings
  const memberships = await db
    .select({
      tenantId: tenantMembers.tenantId,
      name: tenants.name,
      slug: tenants.slug,
    })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
    .where(eq(tenantMembers.userId, user.id));

  const stores = memberships.map((m) => ({
    id: m.tenantId,
    name: m.name,
    slug: m.slug,
  }));

  return <NotificationSettings stores={stores} />;
}
