"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BalanceOverviewCard } from "./balance-overview-card";
import { TransactionHistory } from "./transaction-history";
import { PayoutMethodsCard } from "./payout-methods-card";
import { PayoutHistory } from "./payout-history";
import type {
  SellerBalance,
  SellerTransaction,
  SellerPayoutMethod,
  SellerPayout,
} from "@/lib/db/queries/earnings";

interface EarningsPageClientProps {
  tenantId: string;
  storeSlug: string;
  storeName: string;
  currency: string;
  balance: SellerBalance & {
    availableNum: number;
    pendingNum: number;
    reservedNum: number;
    totalBalance: number;
    lifetimeEarningsNum: number;
    lifetimePaidOutNum: number;
  };
  transactions: SellerTransaction[];
  transactionCount: number;
  payoutMethods: SellerPayoutMethod[];
  payouts: (SellerPayout & {
    payoutMethod: SellerPayoutMethod | null;
  })[];
  payoutCount: number;
}

export function EarningsPageClient({
  tenantId,
  storeSlug: _storeSlug,
  currency,
  balance,
  transactions,
  transactionCount,
  payoutMethods,
  payouts,
  payoutCount,
}: EarningsPageClientProps) {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">Earnings</h1>
        <p className="text-muted-foreground">
          Manage your earnings and payouts
        </p>
      </div>

      {/* Balance Overview */}
      <BalanceOverviewCard
        tenantId={tenantId}
        currency={currency}
        balance={balance}
        payoutMethods={payoutMethods}
      />

      {/* Tabs for Transactions and Payouts */}
      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">
            Transactions ({transactionCount})
          </TabsTrigger>
          <TabsTrigger value="payouts">Payouts ({payoutCount})</TabsTrigger>
          <TabsTrigger value="methods">
            Payout Methods ({payoutMethods.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          <TransactionHistory
            tenantId={tenantId}
            currency={currency}
            transactions={transactions}
            totalCount={transactionCount}
          />
        </TabsContent>

        <TabsContent value="payouts" className="space-y-4">
          <PayoutHistory
            tenantId={tenantId}
            currency={currency}
            payouts={payouts}
            totalCount={payoutCount}
          />
        </TabsContent>

        <TabsContent value="methods" className="space-y-4">
          <PayoutMethodsCard
            tenantId={tenantId}
            payoutMethods={payoutMethods}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
