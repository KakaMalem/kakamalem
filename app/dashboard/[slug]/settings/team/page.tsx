import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getUserStoreContext } from "@/lib/auth/context";
import { canAccessSettingsPage } from "@/lib/config/settings-permissions";
import { AccessDenied } from "@/components/access-denied";
import { getTeamMembers } from "@/lib/db/queries/team";
import { TeamSettings } from "./team-settings";

interface TeamSettingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function TeamSettingsPage({
  params,
}: TeamSettingsPageProps) {
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
  if (!userContext || !canAccessSettingsPage(userContext.role, "team")) {
    return (
      <AccessDenied
        message="Only the store owner can manage team members."
        backUrl={`/dashboard/${slug}/settings`}
        backLabel="Back to Settings"
      />
    );
  }

  const members = await getTeamMembers(store.id);

  return (
    <TeamSettings
      storeId={store.id}
      members={members}
      currentUserId={user.id}
    />
  );
}
