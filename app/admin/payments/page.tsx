import { requirePlatformAdmin } from "@/lib/auth/server";
import {
  getPlatformInvoices,
  getPlatformTransactions,
  getPlatformBillingStats,
} from "@/lib/db/queries/admin";
import { PlatformBillingClient } from "./platform-billing-client";
import { UnresolvedPayouts } from "./unresolved-payouts";
import { getUnresolvedPayouts } from "@/lib/actions/payouts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

/**
 * Admin Payments & Billing Dashboard
 *
 * Platform billing — subscription invoices, trial activations, service revenue.
 */
export default async function AdminPaymentsPage() {
  await requirePlatformAdmin();

  const [transactions, invoices, stats, unresolvedPayouts] = await Promise.all([
    getPlatformTransactions({ limit: 20 }),
    getPlatformInvoices({ limit: 20 }),
    getPlatformBillingStats(),
    // Seller withdrawals HesabPay never confirmed. Their money is held until
    // someone checks and says which way it went.
    getUnresolvedPayouts(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
          Financial Control Center
        </h1>
        <p className="text-muted-foreground font-medium">
          Monitor platform revenue and manage service invoices.
        </p>
      </div>

      <UnresolvedPayouts payouts={unresolvedPayouts} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-black uppercase tracking-widest text-primary/70">
              Total Collected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black tracking-tighter">
                {stats.paidRevenue.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-muted-foreground uppercase">
                AFN
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold">
              PLATFORM SERVICE REVENUE
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              Pending Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black tracking-tighter">
                {stats.pendingRevenue.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-muted-foreground uppercase">
                AFN
              </span>
            </div>
            <p className="text-[10px] text-orange-600/80 mt-1 font-black uppercase">
              Open & Overdue Invoices
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-foreground/5 overflow-hidden relative">
          <div className="absolute -right-4 -top-4 size-24 bg-primary/10 rounded-full blur-3xl" />
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              Active Pro Yield
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black tracking-tighter">
                {stats.activeProCount}
              </span>
              <span className="text-xs font-bold text-muted-foreground">
                STORES
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold uppercase">
              STABLE REVENUE BASE
            </p>
          </CardContent>
        </Card>
      </div>

      <PlatformBillingClient transactions={transactions} invoices={invoices} />
    </div>
  );
}
