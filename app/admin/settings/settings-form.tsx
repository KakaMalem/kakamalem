"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { updatePlatformSettings } from "@/lib/actions/admin";
import {
  Loader2,
  Save,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Wallet,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { ProPriceInfo } from "@/lib/stripe";
import type { UsdtWalletConfig } from "@/lib/db/schema";

// =============================================================================
// SETTINGS FORM CLIENT COMPONENT
// =============================================================================

interface SettingsFormProps {
  settings: {
    id: string | null;
    proPlanPriceAfn: string;
    proPlanYearlyPriceAfn: string;
    freeProductLimit: number;
    trialDurationDays: number;
    transactionFeePercent: string;
    trialWarningDays: number;
    usdtWalletConfig: UsdtWalletConfig | null;
  };
  /** Is Stripe configured */
  stripeEnabled?: boolean;
  /** Stripe Pro price info (source of truth when configured) */
  stripePriceInfo?: ProPriceInfo | null;
  /** Stripe yearly price info */
  stripeYearlyPriceInfo?: ProPriceInfo | null;
}

export function SettingsForm({
  settings,
  stripeEnabled = false,
  stripePriceInfo,
  stripeYearlyPriceInfo,
}: SettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    proPlanPriceAfn: settings.proPlanPriceAfn,
    proPlanYearlyPriceAfn: settings.proPlanYearlyPriceAfn,
    freeProductLimit: settings.freeProductLimit,
    trialDurationDays: settings.trialDurationDays,
    transactionFeePercent: settings.transactionFeePercent,
    trialWarningDays: settings.trialWarningDays,
  });

  // USDT wallet config state
  const [usdtConfig, setUsdtConfig] = useState<UsdtWalletConfig>(
    settings.usdtWalletConfig || {
      trc20: { address: "", enabled: false },
      erc20: { address: "", enabled: false },
      bep20: { address: "", enabled: false },
      minAmount: 1,
      expirationMinutes: 60,
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      const result = await updatePlatformSettings({
        proPlanPriceAfn: formData.proPlanPriceAfn,
        proPlanYearlyPriceAfn: formData.proPlanYearlyPriceAfn,
        freeProductLimit: formData.freeProductLimit,
        trialDurationDays: formData.trialDurationDays,
        transactionFeePercent: formData.transactionFeePercent,
        trialWarningDays: formData.trialWarningDays,
        usdtWalletConfig: usdtConfig,
      });

      if (result.success) {
        toast.success(result.message || "Settings saved");
      } else {
        toast.error(result.error);
      }
    });
  };

  const hasChanges =
    formData.proPlanPriceAfn !== settings.proPlanPriceAfn ||
    formData.proPlanYearlyPriceAfn !== settings.proPlanYearlyPriceAfn ||
    formData.freeProductLimit !== settings.freeProductLimit ||
    formData.trialDurationDays !== settings.trialDurationDays ||
    formData.transactionFeePercent !== settings.transactionFeePercent ||
    formData.trialWarningDays !== settings.trialWarningDays ||
    JSON.stringify(usdtConfig) !== JSON.stringify(settings.usdtWalletConfig);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Stripe Pricing (Source of Truth) */}
      {stripeEnabled && (
        <>
          <div>
            <h3 className="text-lg font-medium flex items-center gap-2">
              Pro Plan Pricing
              <Badge variant="secondary" className="font-normal">
                Stripe
              </Badge>
            </h3>
            <p className="text-sm text-muted-foreground">
              Managed in Stripe Dashboard (source of truth)
            </p>
          </div>

          {stripePriceInfo ? (
            <div className="rounded-lg border bg-card">
              {/* Header */}
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="font-medium">
                    {stripePriceInfo.productName}
                  </span>
                  {stripePriceInfo.active ? (
                    <Badge variant="default" className="bg-green-600">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Inactive</Badge>
                  )}
                </div>
                <a
                  href="https://dashboard.stripe.com/products"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  Edit in Stripe
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {/* Description */}
              {stripePriceInfo.productDescription && (
                <div className="border-b px-4 py-2">
                  <p className="text-sm text-muted-foreground">
                    {stripePriceInfo.productDescription}
                  </p>
                </div>
              )}

              {/* Pricing Grid */}
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                {/* Monthly Price */}
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Monthly
                    </span>
                  </div>
                  <div className="text-2xl font-bold">
                    {stripePriceInfo.amount}{" "}
                    <span className="text-base font-normal text-muted-foreground">
                      {stripePriceInfo.currency}/mo
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {stripePriceInfo.priceId}
                  </div>
                </div>

                {/* Yearly Price */}
                {stripeYearlyPriceInfo ? (
                  <div className="rounded-lg border border-green-200 bg-green-50/50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Yearly
                      </span>
                      <Badge className="bg-green-600">
                        Save{" "}
                        {Math.round(
                          (1 -
                            stripeYearlyPriceInfo.amount /
                              (stripePriceInfo.amount * 12)) *
                            100
                        )}
                        %
                      </Badge>
                    </div>
                    <div className="text-2xl font-bold">
                      {stripeYearlyPriceInfo.amount}{" "}
                      <span className="text-base font-normal text-muted-foreground">
                        {stripeYearlyPriceInfo.currency}/yr
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {stripeYearlyPriceInfo.priceId}
                    </div>
                    {!stripeYearlyPriceInfo.active && (
                      <Badge variant="destructive" className="mt-1">
                        Inactive
                      </Badge>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground text-center">
                      No yearly price configured
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Stripe Price Not Found</AlertTitle>
              <AlertDescription>
                The STRIPE_PRO_PRICE_ID environment variable is set but the
                price could not be found in Stripe. Please verify the price
                exists and is active.
              </AlertDescription>
            </Alert>
          )}

          <Separator />
        </>
      )}

      {/* HesabPay Fallback Pricing */}
      <div>
        <h3 className="text-lg font-medium flex items-center gap-2">
          {stripeEnabled
            ? "Fallback Pricing (HesabPay)"
            : "Subscription Pricing"}
          {!stripeEnabled && (
            <Badge variant="outline" className="font-normal">
              HesabPay
            </Badge>
          )}
        </h3>
        <p className="text-sm text-muted-foreground">
          {stripeEnabled
            ? "Used when Stripe is unavailable (local AFN payments)"
            : "Configure pricing for the Pro plan"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="proPlanPriceAfn">Pro Plan Price (AFN/month)</Label>
          <Input
            id="proPlanPriceAfn"
            type="number"
            min="0"
            step="100"
            value={formData.proPlanPriceAfn}
            onChange={(e) =>
              setFormData({ ...formData, proPlanPriceAfn: e.target.value })
            }
            onWheel={(e) => e.currentTarget.blur()}
          />
          <p className="text-xs text-muted-foreground">
            {stripeEnabled
              ? "Fallback price for HesabPay payments"
              : "Monthly subscription price for Pro plan"}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="proPlanYearlyPriceAfn">
            Pro Plan Price (AFN/year)
          </Label>
          <Input
            id="proPlanYearlyPriceAfn"
            type="number"
            min="0"
            step="100"
            value={formData.proPlanYearlyPriceAfn}
            onChange={(e) =>
              setFormData({
                ...formData,
                proPlanYearlyPriceAfn: e.target.value,
              })
            }
            onWheel={(e) => e.currentTarget.blur()}
          />
          <p className="text-xs text-muted-foreground">
            Yearly subscription price (set lower than 12x monthly for discount)
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="transactionFeePercent">
            Transaction Fee (%) - Future Use
          </Label>
          <Input
            id="transactionFeePercent"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={formData.transactionFeePercent}
            onChange={(e) =>
              setFormData({
                ...formData,
                transactionFeePercent: e.target.value,
              })
            }
            onWheel={(e) => e.currentTarget.blur()}
          />
          <p className="text-xs text-muted-foreground">
            Currently disabled (set to 0)
          </p>
        </div>
      </div>

      <Separator />

      {/* Free Tier Limits */}
      <div>
        <h3 className="text-lg font-medium">Free Tier Limits</h3>
        <p className="text-sm text-muted-foreground">
          Restrictions for free plan stores
        </p>
      </div>

      <div className="space-y-2 max-w-sm">
        <Label htmlFor="freeProductLimit">Max Products (Free)</Label>
        <Input
          id="freeProductLimit"
          type="number"
          min="1"
          max="1000"
          value={formData.freeProductLimit}
          onChange={(e) =>
            setFormData({
              ...formData,
              freeProductLimit: parseInt(e.target.value) || 20,
            })
          }
          onWheel={(e) => e.currentTarget.blur()}
        />
        <p className="text-xs text-muted-foreground">
          Maximum products on free plan
        </p>
      </div>

      <Separator />

      {/* Trial Settings */}
      <div>
        <h3 className="text-lg font-medium">Trial Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure free trial behavior
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="trialDurationDays">Trial Duration (days)</Label>
          <Input
            id="trialDurationDays"
            type="number"
            min="1"
            max="90"
            value={formData.trialDurationDays}
            onChange={(e) =>
              setFormData({
                ...formData,
                trialDurationDays: parseInt(e.target.value) || 7,
              })
            }
            onWheel={(e) => e.currentTarget.blur()}
          />
          <p className="text-xs text-muted-foreground">
            How long new stores get free trial
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="trialWarningDays">Warning Before Expiry (days)</Label>
          <Input
            id="trialWarningDays"
            type="number"
            min="1"
            max="30"
            value={formData.trialWarningDays}
            onChange={(e) =>
              setFormData({
                ...formData,
                trialWarningDays: parseInt(e.target.value) || 3,
              })
            }
            onWheel={(e) => e.currentTarget.blur()}
          />
          <p className="text-xs text-muted-foreground">
            Days before trial ends to show in dashboard
          </p>
        </div>
      </div>

      <Separator />

      {/* USDT Crypto Payments */}
      <div>
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Wallet className="size-5" />
          USDT Crypto Payments
        </h3>
        <p className="text-sm text-muted-foreground">
          Configure self-hosted USDT wallet addresses for crypto payments
        </p>
      </div>

      <div className="space-y-6">
        {/* TRC20 Wallet */}
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">TRC20 (Tron Network)</h4>
              <p className="text-xs text-muted-foreground">
                Low fees (~1 USDT), fast confirmation
              </p>
            </div>
            <Switch
              checked={usdtConfig.trc20?.enabled || false}
              onCheckedChange={(checked) =>
                setUsdtConfig({
                  ...usdtConfig,
                  trc20: { ...usdtConfig.trc20!, enabled: checked },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trc20Address">TRC20 Wallet Address</Label>
            <Input
              id="trc20Address"
              placeholder="T..."
              value={usdtConfig.trc20?.address || ""}
              onChange={(e) =>
                setUsdtConfig({
                  ...usdtConfig,
                  trc20: { ...usdtConfig.trc20!, address: e.target.value },
                })
              }
            />
          </div>
        </div>

        {/* ERC20 Wallet */}
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">ERC20 (Ethereum Network)</h4>
              <p className="text-xs text-muted-foreground">
                Higher fees (~5-20 USDT), widely supported
              </p>
            </div>
            <Switch
              checked={usdtConfig.erc20?.enabled || false}
              onCheckedChange={(checked) =>
                setUsdtConfig({
                  ...usdtConfig,
                  erc20: { ...usdtConfig.erc20!, enabled: checked },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="erc20Address">ERC20 Wallet Address</Label>
            <Input
              id="erc20Address"
              placeholder="0x..."
              value={usdtConfig.erc20?.address || ""}
              onChange={(e) =>
                setUsdtConfig({
                  ...usdtConfig,
                  erc20: { ...usdtConfig.erc20!, address: e.target.value },
                })
              }
            />
          </div>
        </div>

        {/* BEP20 Wallet */}
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">BEP20 (BNB Smart Chain)</h4>
              <p className="text-xs text-muted-foreground">
                Low fees (~0.50 USDT), fast confirmation
              </p>
            </div>
            <Switch
              checked={usdtConfig.bep20?.enabled || false}
              onCheckedChange={(checked) =>
                setUsdtConfig({
                  ...usdtConfig,
                  bep20: { ...usdtConfig.bep20!, enabled: checked },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bep20Address">BEP20 Wallet Address</Label>
            <Input
              id="bep20Address"
              placeholder="0x..."
              value={usdtConfig.bep20?.address || ""}
              onChange={(e) =>
                setUsdtConfig({
                  ...usdtConfig,
                  bep20: { ...usdtConfig.bep20!, address: e.target.value },
                })
              }
            />
          </div>
        </div>

        {/* Crypto Settings */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="minUsdtAmount">Minimum Amount (USDT)</Label>
            <Input
              id="minUsdtAmount"
              type="number"
              min="1"
              step="1"
              value={usdtConfig.minAmount || 1}
              onChange={(e) =>
                setUsdtConfig({
                  ...usdtConfig,
                  minAmount: parseFloat(e.target.value) || 1,
                })
              }
              onWheel={(e) => e.currentTarget.blur()}
            />
            <p className="text-xs text-muted-foreground">
              Minimum payment amount in USDT
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expirationMinutes">
              Session Expiration (minutes)
            </Label>
            <Input
              id="expirationMinutes"
              type="number"
              min="15"
              max="1440"
              step="15"
              value={usdtConfig.expirationMinutes || 60}
              onChange={(e) =>
                setUsdtConfig({
                  ...usdtConfig,
                  expirationMinutes: parseInt(e.target.value) || 60,
                })
              }
              onWheel={(e) => e.currentTarget.blur()}
            />
            <p className="text-xs text-muted-foreground">
              How long customers have to complete payment
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Submit */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || !hasChanges}>
          {isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Save className="mr-2 size-4" />
          )}
          Save Changes
        </Button>
      </div>
    </form>
  );
}
