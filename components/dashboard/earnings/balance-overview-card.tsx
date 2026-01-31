"use client";

import { useState } from "react";
import {
  Wallet,
  Clock,
  Lock,
  TrendingUp,
  ArrowUpRight,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatPrice } from "@/lib/utils";
import { RequestPayoutDialog } from "./request-payout-dialog";
import type {
  SellerBalance,
  SellerPayoutMethod,
} from "@/lib/db/queries/earnings";

interface BalanceOverviewCardProps {
  tenantId: string;
  currency: string;
  balance: SellerBalance & {
    availableNum: number;
    pendingNum: number;
    reservedNum: number;
    totalBalance: number;
    lifetimeEarningsNum: number;
    lifetimePaidOutNum: number;
  };
  payoutMethods: SellerPayoutMethod[];
}

export function BalanceOverviewCard({
  tenantId,
  currency,
  balance,
  payoutMethods,
}: BalanceOverviewCardProps) {
  const [showPayoutDialog, setShowPayoutDialog] = useState(false);

  const canRequestPayout = balance.availableNum > 0 && payoutMethods.length > 0;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Available Balance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Available Balance
            </CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Wallet className="size-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Ready to withdraw</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatPrice(balance.availableNum, currency)}
            </div>
            <Button
              size="sm"
              className="mt-3 w-full"
              disabled={!canRequestPayout}
              onClick={() => setShowPayoutDialog(true)}
            >
              <ArrowUpRight className="mr-2 size-4" />
              Request Payout
            </Button>
            {!canRequestPayout && payoutMethods.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Add a payout method first
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pending Balance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Clock className="size-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Funds from recent orders (holding period:{" "}
                    {balance.payoutHoldDays} days)
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatPrice(balance.pendingNum, currency)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              From recent orders
            </p>
          </CardContent>
        </Card>

        {/* Reserved Balance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reserved</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Lock className="size-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Held for pending payouts or disputes</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatPrice(balance.reservedNum, currency)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Pending payouts
            </p>
          </CardContent>
        </Card>

        {/* Lifetime Earnings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Lifetime Earnings
            </CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(balance.lifetimeEarningsNum, currency)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatPrice(balance.lifetimePaidOutNum, currency)} paid out
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Total Balance Summary */}
      <Card className="bg-muted/30">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Info className="size-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Total Balance (Available + Pending + Reserved)
            </span>
          </div>
          <span className="text-lg font-semibold">
            {formatPrice(balance.totalBalance, currency)}
          </span>
        </CardContent>
      </Card>

      {/* Request Payout Dialog */}
      <RequestPayoutDialog
        open={showPayoutDialog}
        onOpenChange={setShowPayoutDialog}
        tenantId={tenantId}
        currency={currency}
        availableBalance={balance.availableNum}
        payoutMethods={payoutMethods}
      />
    </>
  );
}
