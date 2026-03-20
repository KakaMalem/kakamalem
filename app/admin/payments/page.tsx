import { requirePlatformAdmin } from "@/lib/auth/server";
import { getPendingCryptoPayments } from "@/lib/actions/crypto-payments";
import { CryptoVerificationsClient } from "./crypto-verifications-client";
import {
  getPlatformInvoices,
  getPlatformTransactions,
  getPlatformBillingStats,
} from "@/lib/db/queries/admin";
import { PlatformBillingClient } from "./platform-billing-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Receipt, Wallet } from "lucide-react";

/**
 * Admin Payments & Billing Dashboard
 *
 * Centralized hub for:
 * 1. Platform Billing (Subscription invoices, trial activations, service revenue)
 * 2. Order Payments (Crypto verification, manual payment processing)
 */
export default async function AdminPaymentsPage() {
  // Auth check - platform admin only
  await requirePlatformAdmin();

  // Fetch all payment-related data across the platform
  const [cryptoResult, transactions, invoices, stats] = await Promise.all([
    getPendingCryptoPayments({ limit: 50 }),
    getPlatformTransactions({ limit: 20 }),
    getPlatformInvoices({ limit: 20 }),
    getPlatformBillingStats(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
          Financial Control Center
        </h1>
        <p className="text-muted-foreground font-medium">
          Monitor platform revenue, manage service invoices, and verify crypto
          settlements.
        </p>
      </div>

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

      <Tabs defaultValue="service" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="service" className="gap-2">
            <Receipt className="size-4" />
            Service Billing
          </TabsTrigger>
          <TabsTrigger value="crypto" className="gap-2 relative">
            <Wallet className="size-4" />
            Crypto Orders
            {cryptoResult.success &&
              cryptoResult.data &&
              cryptoResult.data.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white">
                  {cryptoResult.data.length}
                </span>
              )}
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent
            value="service"
            className="space-y-6 border-none p-0 outline-none"
          >
            <PlatformBillingClient
              transactions={transactions}
              invoices={invoices}
            />
          </TabsContent>

          <TabsContent
            value="crypto"
            className="space-y-6 border-none p-0 outline-none"
          >
            {!cryptoResult.success ? (
              <div className="p-6 text-destructive">{cryptoResult.error}</div>
            ) : (
              <CryptoVerificationsClient payments={cryptoResult.data || []} />
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
