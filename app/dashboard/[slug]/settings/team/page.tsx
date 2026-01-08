import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
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

  // Verify ownership (only owner can manage team)
  if (store.ownerId !== user.id) {
    notFound();
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
