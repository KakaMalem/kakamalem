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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Building2, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";
import { saveAffiliatePayoutMethod } from "@/lib/actions/platform-affiliates";

type PayoutMethod = "bank_transfer" | "mobile_money" | "crypto";
type CryptoNetwork = "trc20" | "erc20" | "bep20";

interface PayoutMethodDialogProps {
  currentMethod?: string | null;
  currentDetails?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    mobileNumber?: string;
    provider?: string;
    walletAddress?: string;
    network?: CryptoNetwork;
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

  // Crypto fields
  const [walletAddress, setWalletAddress] = useState(
    currentDetails?.walletAddress || ""
  );
  const [cryptoNetwork, setCryptoNetwork] = useState<CryptoNetwork>(
    currentDetails?.network || "trc20"
  );

  const handleSave = async () => {
    setIsLoading(true);
    try {
      let details;
      if (method === "bank_transfer") {
        details = { bankName, accountName, accountNumber };
      } else if (method === "mobile_money") {
        details = { mobileNumber, provider };
      } else {
        details = { walletAddress, network: cryptoNetwork };
      }

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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bank_transfer">
              <Building2 className="mr-2 size-4" />
              Bank
            </TabsTrigger>
            <TabsTrigger value="mobile_money">
              <Smartphone className="mr-2 size-4" />
              Mobile
            </TabsTrigger>
            <TabsTrigger value="crypto">
              <Wallet className="mr-2 size-4" />
              USDT
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bank_transfer" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="bank-name">Bank Name</Label>
              <Select value={bankName} onValueChange={setBankName}>
                <SelectTrigger id="bank-name">
                  <SelectValue placeholder="Select bank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="azizi_bank">Azizi Bank</SelectItem>
                  <SelectItem value="aib">
                    Afghanistan International Bank
                  </SelectItem>
                  <SelectItem value="kabul_bank">New Kabul Bank</SelectItem>
                  <SelectItem value="ghazanfar_bank">Ghazanfar Bank</SelectItem>
                  <SelectItem value="maiwand_bank">Maiwand Bank</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
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
                placeholder="+93 7XX XXX XXXX"
              />
            </div>
          </TabsContent>

          <TabsContent value="crypto" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="crypto-network">Network</Label>
              <Select
                value={cryptoNetwork}
                onValueChange={(v) => setCryptoNetwork(v as CryptoNetwork)}
              >
                <SelectTrigger id="crypto-network">
                  <SelectValue placeholder="Select network" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trc20">
                    TRC20 (Tron) - Low fees ~$1
                  </SelectItem>
                  <SelectItem value="bep20">
                    BEP20 (BSC) - Low fees ~$0.50
                  </SelectItem>
                  <SelectItem value="erc20">
                    ERC20 (Ethereum) - Higher fees
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                TRC20 is recommended for lower transaction fees
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wallet-address">USDT Wallet Address</Label>
              <Input
                id="wallet-address"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder={cryptoNetwork === "trc20" ? "T..." : "0x..."}
              />
              <p className="text-xs text-muted-foreground">
                Make sure this address supports{" "}
                {cryptoNetwork === "trc20"
                  ? "TRC20"
                  : cryptoNetwork === "bep20"
                    ? "BEP20"
                    : "ERC20"}{" "}
                USDT
              </p>
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
