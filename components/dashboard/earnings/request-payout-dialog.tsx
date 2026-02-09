"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Building2, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatPrice } from "@/lib/utils";
import { requestPayout } from "@/lib/actions/earnings";
import type { SellerPayoutMethod } from "@/lib/db/queries/earnings";

interface RequestPayoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  currency: string;
  availableBalance: number;
  payoutMethods: SellerPayoutMethod[];
}

export function RequestPayoutDialog({
  open,
  onOpenChange,
  tenantId,
  currency,
  availableBalance,
  payoutMethods,
}: RequestPayoutDialogProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedMethodId, setSelectedMethodId] = useState(
    payoutMethods.find((m) => m.isDefault)?.id || payoutMethods[0]?.id || ""
  );
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const numericAmount = parseFloat(amount) || 0;
  const isValidAmount = numericAmount > 0 && numericAmount <= availableBalance;

  const selectedMethod = payoutMethods.find((m) => m.id === selectedMethodId);

  const handleSubmit = async () => {
    if (!isValidAmount || !selectedMethodId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await requestPayout(tenantId, {
        amount: numericAmount,
        payoutMethodId: selectedMethodId,
        notes: notes || undefined,
      });

      if (result.success) {
        toast.success("Payout requested", {
          description: `Payout #${result.data?.payoutNumber} has been submitted`,
        });
        onOpenChange(false);
        setAmount("");
        setNotes("");
        router.refresh();
      } else {
        setError(result.error || "Failed to request payout");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const setMaxAmount = () => {
    setAmount(availableBalance.toString());
  };

  const getMethodIcon = (type: string) => {
    switch (type) {
      case "bank_transfer":
        return <Building2 className="size-4" />;
      case "mobile_money":
        return <Smartphone className="size-4" />;
      default:
        return null;
    }
  };

  const getMethodDisplayName = (method: SellerPayoutMethod) => {
    if (method.label) return method.label;
    switch (method.type) {
      case "bank_transfer":
        return `${method.bankName} - ****${method.accountNumber?.slice(-4)}`;
      case "mobile_money":
        return `${method.mobileProvider} - ${method.mobileNumber}`;
      default:
        return method.type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>Request Payout</DialogTitle>
          <DialogDescription>
            Request a withdrawal from your available balance. Available:{" "}
            {formatPrice(availableBalance, currency)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount ({currency})</Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={0}
                max={availableBalance}
                step="0.01"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs"
                onClick={setMaxAmount}
              >
                Max
              </Button>
            </div>
            {numericAmount > availableBalance && (
              <p className="text-sm text-destructive">
                Amount exceeds available balance
              </p>
            )}
          </div>

          {/* Payout Method */}
          <div className="space-y-2">
            <Label htmlFor="method">Payout Method</Label>
            <Select
              value={selectedMethodId}
              onValueChange={setSelectedMethodId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a payout method" />
              </SelectTrigger>
              <SelectContent>
                {payoutMethods.map((method) => (
                  <SelectItem key={method.id} value={method.id}>
                    <div className="flex items-center gap-2">
                      {getMethodIcon(method.type)}
                      <span>{getMethodDisplayName(method)}</span>
                      {method.isDefault && (
                        <span className="text-xs text-muted-foreground">
                          (Default)
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Method Details */}
          {selectedMethod && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium">
                {selectedMethod.type === "bank_transfer"
                  ? "Bank Transfer"
                  : "Mobile Money"}
              </p>
              {selectedMethod.type === "bank_transfer" && (
                <>
                  <p className="text-muted-foreground">
                    {selectedMethod.bankName}
                  </p>
                  <p className="text-muted-foreground">
                    Account: {selectedMethod.accountNumber}
                  </p>
                  <p className="text-muted-foreground">
                    Name: {selectedMethod.accountName}
                  </p>
                </>
              )}
              {selectedMethod.type === "mobile_money" && (
                <>
                  <p className="text-muted-foreground">
                    {selectedMethod.mobileProvider}
                  </p>
                  <p className="text-muted-foreground">
                    {selectedMethod.mobileNumber}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Error */}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValidAmount || !selectedMethodId || isLoading}
          >
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Request{" "}
            {isValidAmount ? formatPrice(numericAmount, currency) : "Payout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
