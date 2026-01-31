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
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { addPayoutMethod } from "@/lib/actions/earnings";
import type { PayoutMethodInput } from "@/lib/validations/earnings";

interface AddPayoutMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
}

type MethodType = "bank_transfer" | "mobile_money";

export function AddPayoutMethodDialog({
  open,
  onOpenChange,
  tenantId,
}: AddPayoutMethodDialogProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [methodType, setMethodType] = useState<MethodType>("bank_transfer");
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bank transfer fields
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [label, setLabel] = useState("");

  // Mobile money fields
  const [mobileProvider, setMobileProvider] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");

  const resetForm = () => {
    setMethodType("bank_transfer");
    setIsDefault(false);
    setBankName("");
    setAccountNumber("");
    setAccountName("");
    setLabel("");
    setMobileProvider("");
    setMobileNumber("");
    setError(null);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let input: PayoutMethodInput;

      if (methodType === "bank_transfer") {
        if (!bankName || !accountNumber || !accountName) {
          setError("Please fill in all required fields");
          setIsLoading(false);
          return;
        }
        input = {
          type: "bank_transfer",
          bankName,
          accountNumber,
          accountName,
          label: label || undefined,
          isDefault,
        };
      } else {
        if (!mobileProvider || !mobileNumber) {
          setError("Please fill in all required fields");
          setIsLoading(false);
          return;
        }
        input = {
          type: "mobile_money",
          mobileProvider,
          mobileNumber,
          accountName: accountName || undefined,
          label: label || undefined,
          isDefault,
        };
      }

      const result = await addPayoutMethod(tenantId, input);

      if (result.success) {
        toast.success("Payout method added");
        onOpenChange(false);
        resetForm();
        router.refresh();
      } else {
        setError(result.error || "Failed to add payout method");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) resetForm();
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Payout Method</DialogTitle>
          <DialogDescription>
            Add a bank account or mobile money number to receive payouts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Method Type Selection */}
          <RadioGroup
            value={methodType}
            onValueChange={(v) => setMethodType(v as MethodType)}
            className="grid grid-cols-2 gap-4"
          >
            <Label
              htmlFor="bank_transfer"
              className="flex cursor-pointer flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
            >
              <RadioGroupItem
                value="bank_transfer"
                id="bank_transfer"
                className="sr-only"
              />
              <Building2 className="mb-3 size-6" />
              <span className="text-sm font-medium">Bank Transfer</span>
            </Label>
            <Label
              htmlFor="mobile_money"
              className="flex cursor-pointer flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
            >
              <RadioGroupItem
                value="mobile_money"
                id="mobile_money"
                className="sr-only"
              />
              <Smartphone className="mb-3 size-6" />
              <span className="text-sm font-medium">Mobile Money</span>
            </Label>
          </RadioGroup>

          {/* Bank Transfer Fields */}
          {methodType === "bank_transfer" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank Name *</Label>
                <Input
                  id="bankName"
                  placeholder="e.g., Afghanistan International Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number *</Label>
                <Input
                  id="accountNumber"
                  placeholder="Enter your account number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountName">Account Holder Name *</Label>
                <Input
                  id="accountName"
                  placeholder="Name on the bank account"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Mobile Money Fields */}
          {methodType === "mobile_money" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mobileProvider">Provider *</Label>
                <Input
                  id="mobileProvider"
                  placeholder="e.g., M-Paisa, M-Hawala"
                  value={mobileProvider}
                  onChange={(e) => setMobileProvider(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobileNumber">Mobile Number *</Label>
                <Input
                  id="mobileNumber"
                  placeholder="e.g., +93 70 123 4567"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobileAccountName">
                  Account Name (Optional)
                </Label>
                <Input
                  id="mobileAccountName"
                  placeholder="Name registered with the provider"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Common Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="label">Label (Optional)</Label>
              <Input
                id="label"
                placeholder="e.g., My Business Account"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A friendly name to identify this payout method
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isDefault">Set as Default</Label>
                <p className="text-xs text-muted-foreground">
                  Use this method for automatic payouts
                </p>
              </div>
              <Switch
                id="isDefault"
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
            </div>
          </div>

          {/* Error */}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Add Payout Method
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
