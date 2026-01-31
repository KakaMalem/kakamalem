"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  MoreHorizontal,
  Building2,
  Smartphone,
  Banknote,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn, formatPrice } from "@/lib/utils";
import { cancelPayoutRequest } from "@/lib/actions/earnings";
import type {
  SellerPayout,
  SellerPayoutMethod,
} from "@/lib/db/queries/earnings";

interface PayoutHistoryProps {
  tenantId: string;
  currency: string;
  payouts: (SellerPayout & {
    payoutMethod: SellerPayoutMethod | null;
  })[];
  totalCount: number;
}

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    icon: typeof Clock;
    variant: "default" | "secondary" | "destructive" | "outline";
    color: string;
  }
> = {
  pending: {
    label: "Pending",
    icon: Clock,
    variant: "outline",
    color: "text-yellow-600",
  },
  processing: {
    label: "Processing",
    icon: Loader2,
    variant: "secondary",
    color: "text-blue-600",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    variant: "default",
    color: "text-green-600",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    variant: "destructive",
    color: "text-red-600",
  },
  cancelled: {
    label: "Cancelled",
    icon: AlertCircle,
    variant: "outline",
    color: "text-gray-600",
  },
};

export function PayoutHistory({
  tenantId,
  currency,
  payouts,
  totalCount,
}: PayoutHistoryProps) {
  const router = useRouter();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCancel = async () => {
    if (!cancellingId) return;

    setIsLoading(true);
    try {
      const result = await cancelPayoutRequest(tenantId, cancellingId);
      if (result.success) {
        toast.success("Payout cancelled");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to cancel payout");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
      setCancellingId(null);
    }
  };

  const getMethodIcon = (type: string | undefined) => {
    switch (type) {
      case "bank_transfer":
        return <Building2 className="size-4" />;
      case "mobile_money":
        return <Smartphone className="size-4" />;
      default:
        return <Banknote className="size-4" />;
    }
  };

  const getMethodDisplay = (
    method: PayoutHistoryProps["payouts"][0]["payoutMethod"]
  ) => {
    if (!method) return "Unknown method";
    if (method.label) return method.label;
    switch (method.type) {
      case "bank_transfer":
        return `${method.bankName} ****${method.accountNumber?.slice(-4)}`;
      case "mobile_money":
        return `${method.mobileProvider} ${method.mobileNumber}`;
      default:
        return method.type;
    }
  };

  if (payouts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Banknote className="size-12 text-muted-foreground/50" />
          <p className="mt-4 text-lg font-medium">No payouts yet</p>
          <p className="text-sm text-muted-foreground">
            Your payout history will appear here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payout History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {payouts.map((payout) => {
              const config =
                STATUS_CONFIG[payout.status] || STATUS_CONFIG.pending;
              const StatusIcon = config.icon;

              return (
                <div
                  key={payout.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                      {getMethodIcon(payout.payoutMethod?.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {payout.payoutNumber}
                        </span>
                        <Badge variant={config.variant} className="gap-1">
                          <StatusIcon
                            className={cn(
                              "size-3",
                              config.color,
                              payout.status === "processing" && "animate-spin"
                            )}
                          />
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {getMethodDisplay(payout.payoutMethod)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Requested:{" "}
                        {new Date(payout.requestedAt).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="font-semibold">
                        {formatPrice(parseFloat(payout.amount), currency)}
                      </span>
                      {parseFloat(payout.fee) > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Fee: {formatPrice(parseFloat(payout.fee), currency)}
                        </p>
                      )}
                    </div>
                    {payout.status === "pending" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setCancellingId(payout.id)}
                          >
                            Cancel Payout
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalCount > payouts.length && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Showing {payouts.length} of {totalCount} payouts
            </p>
          )}
        </CardContent>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog
        open={!!cancellingId}
        onOpenChange={(open) => !open && setCancellingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Payout Request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the payout request and return the funds to your
              available balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>
              Keep Payout
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Cancel Payout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
