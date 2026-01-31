"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreditCard, Banknote, Check, Info } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

import { savePaymentGatewayConfig } from "@/lib/actions/payments";
import type { PaymentGatewayConfig } from "@/lib/db/schema";

// Available payment gateways with their display info
const PAYMENT_GATEWAYS = [
  {
    gateway: "hesabpay" as const,
    displayName: "Pay with Card (HesabPay)",
    description:
      "Accept card payments via HesabPay. Payments are processed securely through the platform.",
    icon: CreditCard,
    recommended: true,
  },
  {
    gateway: "cod" as const,
    displayName: "Cash on Delivery",
    description:
      "Customers pay when they receive their order. No online payment required.",
    icon: Banknote,
    recommended: false,
  },
] as const;

interface PaymentSettingsFormProps {
  storeId: string;
  initialConfigs: {
    hesabpay: PaymentGatewayConfig | null;
    cod: PaymentGatewayConfig | null;
  };
}

export function PaymentSettingsForm({
  storeId,
  initialConfigs,
}: PaymentSettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Track enabled state for each gateway
  const [enabledGateways, setEnabledGateways] = useState<
    Record<string, boolean>
  >({
    hesabpay: initialConfigs.hesabpay?.isEnabled ?? true, // Default HesabPay to enabled
    cod: initialConfigs.cod?.isEnabled ?? true, // Default COD to enabled
  });

  // Track previous props for sync
  const [prevConfigs, setPrevConfigs] = useState(initialConfigs);
  if (
    prevConfigs.hesabpay?.isEnabled !== initialConfigs.hesabpay?.isEnabled ||
    prevConfigs.cod?.isEnabled !== initialConfigs.cod?.isEnabled
  ) {
    setPrevConfigs(initialConfigs);
    setEnabledGateways({
      hesabpay: initialConfigs.hesabpay?.isEnabled ?? true,
      cod: initialConfigs.cod?.isEnabled ?? true,
    });
  }

  // Check if any gateway is enabled
  const hasAnyEnabled = Object.values(enabledGateways).some(Boolean);

  // Check if configs exist in DB (need initial save)
  const needsInitialSave =
    initialConfigs.hesabpay === null || initialConfigs.cod === null;

  // Track if form has changes
  const hasChanges =
    needsInitialSave ||
    (initialConfigs.hesabpay?.isEnabled ?? true) !== enabledGateways.hesabpay ||
    (initialConfigs.cod?.isEnabled ?? true) !== enabledGateways.cod;

  // Handle toggle
  const handleToggle = (gateway: string, enabled: boolean) => {
    setEnabledGateways((prev) => ({
      ...prev,
      [gateway]: enabled,
    }));
  };

  // Handle save
  const handleSave = () => {
    startTransition(async () => {
      try {
        // Save each gateway config
        const results = await Promise.all(
          PAYMENT_GATEWAYS.map(async (gw) => {
            const result = await savePaymentGatewayConfig(storeId, gw.gateway, {
              displayName: gw.displayName,
              description: gw.description,
              isEnabled: enabledGateways[gw.gateway],
              displayOrder: gw.gateway === "hesabpay" ? 0 : 1,
            });
            return { gateway: gw.gateway, ...result };
          })
        );

        const failed = results.find((r) => !r.success);
        if (failed) {
          toast.error(failed.error || "Failed to save settings");
          return;
        }

        toast.success("Payment settings updated");
        router.refresh();
      } catch {
        toast.error("Failed to save payment settings");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Payment Methods</h2>
        <p className="text-sm text-muted-foreground">
          Configure which payment methods are available to your customers at
          checkout.
        </p>
      </div>

      {/* Warning if no gateway enabled */}
      {!hasAnyEnabled && (
        <Alert variant="destructive">
          <Info className="size-4" />
          <AlertDescription>
            You must enable at least one payment method for customers to
            checkout.
          </AlertDescription>
        </Alert>
      )}

      {/* Platform Info */}
      <Alert>
        <Info className="size-4" />
        <AlertDescription>
          All card payments are processed through the platform&apos;s secure
          payment system. Funds are held until order fulfillment and then
          released to your earnings.
        </AlertDescription>
      </Alert>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available Payment Methods</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {PAYMENT_GATEWAYS.map((gw) => {
            const Icon = gw.icon;
            const isEnabled = enabledGateways[gw.gateway];

            return (
              <div
                key={gw.gateway}
                className={cn(
                  "flex items-start gap-4 rounded-lg border p-4 transition-colors",
                  isEnabled ? "border-primary/50 bg-primary/5" : "bg-muted/30"
                )}
              >
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg",
                    isEnabled
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <Icon className="size-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{gw.displayName}</h3>
                    {gw.recommended && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {gw.description}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isEnabled && <Check className="size-4 text-green-600" />}
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) =>
                      handleToggle(gw.gateway, checked)
                    }
                    disabled={isPending}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* What This Means */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Check className="size-4 text-green-600 mt-0.5 shrink-0" />
              <span>
                <strong>HesabPay:</strong> Customers pay securely online. Funds
                are released to your earnings after order confirmation.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="size-4 text-green-600 mt-0.5 shrink-0" />
              <span>
                <strong>Cash on Delivery:</strong> Customers pay when they
                receive their order. You collect payment directly.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isPending || !hasChanges || !hasAnyEnabled}
        >
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
