import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getUser } from "@/lib/auth/server";
import { getPlatformAffiliateByUserId } from "@/lib/db/queries/platform-affiliates";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AffiliateSidebar } from "@/components/affiliate/affiliate-sidebar";
import { AffiliateDashboardHeader } from "@/components/affiliate/affiliate-dashboard-header";

// Force dynamic rendering - auth state must be checked on every request
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Affiliate Dashboard | Kaka Malem",
  description:
    "Manage your affiliate account, track referrals, and view earnings.",
};

export default async function AffiliateDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect("/login?returnTo=/affiliate/dashboard");
  }

  // Get affiliate account
  const affiliate = await getPlatformAffiliateByUserId(user.id);

  if (!affiliate) {
    // User is not an affiliate, redirect to signup
    redirect("/become-affiliate");
  }

  if (affiliate.status === "suspended") {
    redirect("/become-affiliate"); // Will show suspended message
  }

  if (affiliate.status === "rejected") {
    redirect("/become-affiliate"); // Can re-apply
  }

  // Get sidebar state from cookie
  const cookieStore = await cookies();
  const sidebarState = cookieStore.get("sidebar_state")?.value;
  const defaultOpen = sidebarState !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AffiliateSidebar
        user={{
          id: user.id,
          email: user.email || "",
          fullName: user.name,
          avatarUrl: user.image || undefined,
        }}
        affiliate={{
          id: affiliate.id,
          displayName: affiliate.displayName,
          slug: affiliate.slug,
          currentTier: affiliate.currentTier,
          status: affiliate.status,
        }}
      />
      <SidebarInset>
        <AffiliateDashboardHeader />
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
