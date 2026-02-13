"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CreditCard,
  Banknote,
  Check,
  Info,
  Star,
  Globe,
  Wallet,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { savePaymentGatewayConfig } from "@/lib/actions/payments";
import type { PaymentGatewayConfig } from "@/lib/db/schema";

// Gateway type for stricter typing
type GatewayType = "hesabpay" | "stripe" | "cod" | "crypto_usdt";

// Available payment gateways with their display info
const PAYMENT_GATEWAYS: Array<{
  gateway: GatewayType;
  displayName: string;
  description: string;
  icon: typeof CreditCard;
  recommended: boolean;
  badge: string | null;
}> = [
  {
    gateway: "hesabpay",
    displayName: "Pay with Card (HesabPay)",
    description:
      "Accept card payments via HesabPay. Supports local card payments.",
    icon: CreditCard,
    recommended: true,
    badge: "Local",
  },
  {
    gateway: "stripe",
    displayName: "Pay with Card (International)",
    description:
      "Accept Visa, Mastercard, and more from international customers via Stripe.",
    icon: Globe,
    recommended: false,
    badge: "International",
  },
  {
    gateway: "crypto_usdt",
    displayName: "Pay with USDT",
    description:
      "Accept USDT cryptocurrency payments. Supports TRC20, ERC20, and BEP20 networks.",
    icon: Wallet,
    recommended: false,
    badge: "Crypto",
  },
  {
    gateway: "cod",
    displayName: "Cash on Delivery",
    description:
      "Customers pay when they receive their order. No online payment required.",
    icon: Banknote,
    recommended: false,
    badge: null,
  },
];

interface PaymentSettingsFormProps {
  storeId: string;
  stripeEnabled: boolean;
  cryptoEnabled: boolean;
  initialConfigs: {
    hesabpay: PaymentGatewayConfig | null;
    stripe: PaymentGatewayConfig | null;
    cod: PaymentGatewayConfig | null;
    crypto_usdt: PaymentGatewayConfig | null;
  };
}

// Get initial default gateway from displayOrder (lowest = default)
function getInitialDefault(
  configs: PaymentSettingsFormProps["initialConfigs"]
): GatewayType {
  const orders: Array<{ gateway: GatewayType; order: number }> = [
    { gateway: "hesabpay", order: configs.hesabpay?.displayOrder ?? 0 },
    { gateway: "stripe", order: configs.stripe?.displayOrder ?? 2 },
    { gateway: "cod", order: configs.cod?.displayOrder ?? 1 },
    { gateway: "crypto_usdt", order: configs.crypto_usdt?.displayOrder ?? 3 },
  ];

  // Sort by display order and return the first enabled one
  const sorted = orders.sort((a, b) => a.order - b.order);
  return sorted[0].gateway;
}

export function PaymentSettingsForm({
  storeId,
  stripeEnabled,
  cryptoEnabled,
  initialConfigs,
}: PaymentSettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filter gateways based on availability
  const availableGateways = PAYMENT_GATEWAYS.filter((gw) => {
    // Stripe is only available if configured at platform level
    if (gw.gateway === "stripe" && !stripeEnabled) {
      return false;
    }
    // Crypto USDT is only available if configured at platform level
    if (gw.gateway === "crypto_usdt" && !cryptoEnabled) {
      return false;
    }
    return true;
  });

  // Track enabled state for each gateway
  const [enabledGateways, setEnabledGateways] = useState<
    Record<string, boolean>
  >({
    hesabpay: initialConfigs.hesabpay?.isEnabled ?? true, // Default HesabPay to enabled
    stripe: initialConfigs.stripe?.isEnabled ?? false, // Default Stripe to disabled
    cod: initialConfigs.cod?.isEnabled ?? true, // Default COD to enabled
    crypto_usdt: initialConfigs.crypto_usdt?.isEnabled ?? false, // Default crypto to disabled
  });

  // Track default payment method (shown first at checkout)
  const [defaultGateway, setDefaultGateway] = useState<GatewayType>(
    getInitialDefault(initialConfigs)
  );

  // Track previous props for sync
  const [prevConfigs, setPrevConfigs] = useState(initialConfigs);
  if (
    prevConfigs.hesabpay?.isEnabled !== initialConfigs.hesabpay?.isEnabled ||
    prevConfigs.stripe?.isEnabled !== initialConfigs.stripe?.isEnabled ||
    prevConfigs.cod?.isEnabled !== initialConfigs.cod?.isEnabled ||
    prevConfigs.crypto_usdt?.isEnabled !==
      initialConfigs.crypto_usdt?.isEnabled ||
    prevConfigs.hesabpay?.displayOrder !==
      initialConfigs.hesabpay?.displayOrder ||
    prevConfigs.stripe?.displayOrder !== initialConfigs.stripe?.displayOrder ||
    prevConfigs.cod?.displayOrder !== initialConfigs.cod?.displayOrder ||
    prevConfigs.crypto_usdt?.displayOrder !==
      initialConfigs.crypto_usdt?.displayOrder
  ) {
    setPrevConfigs(initialConfigs);
    setEnabledGateways({
      hesabpay: initialConfigs.hesabpay?.isEnabled ?? true,
      stripe: initialConfigs.stripe?.isEnabled ?? false,
      cod: initialConfigs.cod?.isEnabled ?? true,
      crypto_usdt: initialConfigs.crypto_usdt?.isEnabled ?? false,
    });
    setDefaultGateway(getInitialDefault(initialConfigs));
  }

  // Check if any gateway is enabled
  const hasAnyEnabled = Object.values(enabledGateways).some(Boolean);

  // Check if configs exist in DB (need initial save)
  const needsInitialSave =
    initialConfigs.hesabpay === null || initialConfigs.cod === null;

  // Get initial default for comparison
  const initialDefault = getInitialDefault(initialConfigs);

  // Track if form has changes
  const hasChanges =
    needsInitialSave ||
    (initialConfigs.hesabpay?.isEnabled ?? true) !== enabledGateways.hesabpay ||
    (initialConfigs.stripe?.isEnabled ?? false) !== enabledGateways.stripe ||
    (initialConfigs.cod?.isEnabled ?? true) !== enabledGateways.cod ||
    (initialConfigs.crypto_usdt?.isEnabled ?? false) !==
      enabledGateways.crypto_usdt ||
    initialDefault !== defaultGateway;

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
        // Save each gateway config with display order based on default selection
        const gatewaysToSave = availableGateways;

        const results = await Promise.all(
          gatewaysToSave.map(async (gw, index) => {
            // Default gateway gets displayOrder 0, others get higher values
            const displayOrder = gw.gateway === defaultGateway ? 0 : index + 1;

            const result = await savePaymentGatewayConfig(storeId, gw.gateway, {
              displayName: gw.displayName,
              description: gw.description,
              isEnabled: enabledGateways[gw.gateway],
              displayOrder,
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

  // Get enabled gateways for default selection
  const enabledGatewayList = availableGateways.filter(
    (gw) => enabledGateways[gw.gateway]
  );

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
          {availableGateways.map((gw) => {
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium">{gw.displayName}</h3>
                    {gw.recommended && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    )}
                    {gw.badge && (
                      <Badge variant="secondary" className="text-xs">
                        {gw.badge}
                      </Badge>
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

      {/* Default Payment Method */}
      {hasAnyEnabled && enabledGatewayList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="size-4" />
              Default Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              The default payment method will be pre-selected at checkout.
            </p>
            <RadioGroup
              value={defaultGateway}
              onValueChange={(value) => setDefaultGateway(value as GatewayType)}
              disabled={isPending}
            >
              {enabledGatewayList.map((gw) => {
                const Icon = gw.icon;
                return (
                  <Label
                    key={gw.gateway}
                    htmlFor={`default-${gw.gateway}`}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      defaultGateway === gw.gateway
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <RadioGroupItem
                      value={gw.gateway}
                      id={`default-${gw.gateway}`}
                    />
                    <Icon className="size-4" />
                    <span className="font-medium">{gw.displayName}</span>
                    {gw.badge && (
                      <Badge variant="outline" className="text-xs">
                        {gw.badge}
                      </Badge>
                    )}
                    {defaultGateway === gw.gateway && (
                      <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        Default
                      </span>
                    )}
                  </Label>
                );
              })}
            </RadioGroup>
          </CardContent>
        </Card>
      )}

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
                <strong>HesabPay:</strong> Customers pay securely online with
                local card payment methods.
              </span>
            </li>
            {stripeEnabled && (
              <li className="flex items-start gap-2">
                <Check className="size-4 text-green-600 mt-0.5 shrink-0" />
                <span>
                  <strong>Stripe (International):</strong> Accept payments from
                  anywhere in the world. Supports Visa, Mastercard, and more.
                </span>
              </li>
            )}
            {cryptoEnabled && (
              <li className="flex items-start gap-2">
                <Check className="size-4 text-green-600 mt-0.5 shrink-0" />
                <span>
                  <strong>USDT (Crypto):</strong> Accept USDT stablecoin
                  payments. Supports TRC20, ERC20, and BEP20 networks. Payments
                  are verified manually by the platform.
                </span>
              </li>
            )}
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
