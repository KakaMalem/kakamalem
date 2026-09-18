import { notFound, redirect } from "next/navigation";

import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getUserStoreContext } from "@/lib/auth/context";
import { AccessDenied } from "@/components/access-denied";
import {
  getEarningsTotals,
  getSellerBalance,
  getSellerLedger,
} from "@/lib/payouts/ledger";
import { getPayoutHistory } from "@/lib/actions/payouts";
import { EarningsClient } from "./earnings-client";

interface EarningsPageProps {
  params: Promise<{ slug: string }>;
}

export const metadata = {
  title: "Earnings",
};

export default async function EarningsPage({ params }: EarningsPageProps) {
  const { slug } = await params;
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const context = await getUserStoreContext(store.id);
  const isAdmin =
    context?.isPlatformAdminOverride ||
    context?.role === "owner" ||
    context?.role === "admin";

  if (!context || !isAdmin) {
    return (
      <AccessDenied
        message="You need admin or owner access to view store earnings."
        backUrl={`/dashboard/${slug}`}
        backLabel="Back to Dashboard"
      />
    );
  }

  // Withdrawing money, and changing where it goes, is owner-only.
  const isOwner =
    context.isPlatformAdminOverride || context.role === "owner";

  const [balance, totals, ledger, payouts] = await Promise.all([
    getSellerBalance(store.id),
    getEarningsTotals(store.id),
    getSellerLedger(store.id, 50),
    getPayoutHistory(store.id, 25),
  ]);

  return (
    <EarningsClient
      storeId={store.id}
      storeSlug={store.slug}
      storeCurrency={store.currency}
      isOwner={isOwner}
      balance={balance}
      totals={totals}
      ledger={ledger}
      payouts={payouts}
      payoutAccount={{
        accountNumber: store.hesabpayAccountNumber || "",
        accountName: store.hesabpayAccountName || "",
      }}
    />
  );
}
