import { requirePlatformAdmin } from "@/lib/auth/server";
import { getPendingCryptoPayments } from "@/lib/actions/crypto-payments";
import { CryptoVerificationsClient } from "./crypto-verifications-client";
import {
  getPlatformInvoices,
  getPlatformTransactions,
} from "@/lib/db/queries/admin";
import { PlatformBillingClient } from "./platform-billing-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [cryptoResult, transactions, invoices] = await Promise.all([
    getPendingCryptoPayments({ limit: 50 }),
    getPlatformTransactions({ limit: 20 }),
    getPlatformInvoices({ limit: 20 }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          Payments & Billing
        </h1>
        <p className="text-muted-foreground">
          Manage platform revenue and verify customer payments
        </p>
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
