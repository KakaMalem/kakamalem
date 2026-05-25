"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Building2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { saveAffiliatePayoutMethod } from "@/lib/actions/platform-affiliates";

type PayoutMethod = "bank_transfer" | "mobile_money";

interface PayoutMethodDialogProps {
  currentMethod?: string | null;
  currentDetails?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    mobileNumber?: string;
    provider?: string;
  } | null;
  trigger?: React.ReactNode;
}

export function PayoutMethodDialog({
  currentMethod,
  currentDetails,
  trigger,
}: PayoutMethodDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [method, setMethod] = useState<PayoutMethod>(
    (currentMethod as PayoutMethod) || "bank_transfer"
  );

  // Bank transfer fields
  const [bankName, setBankName] = useState(currentDetails?.bankName || "");
  const [accountName, setAccountName] = useState(
    currentDetails?.accountName || ""
  );
  const [accountNumber, setAccountNumber] = useState(
    currentDetails?.accountNumber || ""
  );

  // Mobile money fields
  const [mobileNumber, setMobileNumber] = useState(
    currentDetails?.mobileNumber || ""
  );
  const provider = currentDetails?.provider || "hesabpay";

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const details =
        method === "bank_transfer"
          ? { bankName, accountName, accountNumber }
          : { mobileNumber, provider };

      const result = await saveAffiliatePayoutMethod({ method, details });

      if (result.success) {
        toast.success("Payout method saved!");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error?.message || "Failed to save payout method");
      }
    } catch (error) {
      console.error("Error saving payout method:", error);
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant={currentMethod ? "outline" : "default"}>
            {currentMethod ? "Update" : "Add Payout Method"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {currentMethod ? "Update Payout Method" : "Add Payout Method"}
          </DialogTitle>
          <DialogDescription>
            Configure how you want to receive your earnings.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={method}
          onValueChange={(v) => setMethod(v as PayoutMethod)}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bank_transfer">
              <Building2 className="mr-2 size-4" />
              Bank
            </TabsTrigger>
            <TabsTrigger value="mobile_money">
              <Smartphone className="mr-2 size-4" />
              Mobile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bank_transfer" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="bank-name">Bank Name</Label>
              <Input
                id="bank-name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g., Chase, HSBC, Deutsche Bank"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-name">Account Holder Name</Label>
              <Input
                id="account-name"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Full name on account"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-number">Account Number</Label>
              <Input
                id="account-number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Your bank account number"
              />
            </div>
          </TabsContent>

          <TabsContent value="mobile_money" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Input
                id="provider"
                value="HesabPay"
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Payouts are processed via HesabPay
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile-number">Mobile Number</Label>
              <Input
                id="mobile-number"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="Your mobile number"
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save Method
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
