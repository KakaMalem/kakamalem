"use client";

import { useEffect } from "react";
import {
  CreditCard,
  Banknote,
  Building2,
  Smartphone,
  AlertCircle,
  Globe,
  Wallet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "@/lib/stores/use-checkout-store";
import type { EnabledGateway } from "@/lib/payments/types";

// Icons for each payment method (using string index for flexibility)
const PAYMENT_ICONS: Record<string, typeof CreditCard> = {
  hesabpay: CreditCard,
  stripe: Globe,
  cod: Banknote,
  bank_transfer: Building2,
  mobile_money: Smartphone,
  crypto_usdt: Wallet,
};

// Badges for payment methods
const PAYMENT_BADGES: Record<
  string,
  { text: string; variant: "recommended" | "info" } | null
> = {
  hesabpay: { text: "Recommended", variant: "recommended" },
  stripe: { text: "International", variant: "info" },
  cod: null,
  bank_transfer: null,
  mobile_money: null,
  crypto_usdt: { text: "Crypto", variant: "info" },
};

// Fallback payment methods if none configured
const FALLBACK_METHODS: EnabledGateway[] = [
  {
    gateway: "cod",
    displayName: "Cash on Delivery",
    description: "Pay when you receive your order",
    displayOrder: 0,
  },
];

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod | null;
  onMethodSelect: (method: PaymentMethod) => void;
  disabled?: boolean;
  currency: string;
  enabledMethods: EnabledGateway[];
  /** Selected crypto network (for crypto_usdt) */
  selectedNetwork?: string;
  /** Called when user selects a crypto network */
  onNetworkSelect?: (network: string) => void;
}

export function PaymentMethodSelector({
  selectedMethod,
  onMethodSelect,
  disabled = false,
  enabledMethods,
  selectedNetwork,
  onNetworkSelect,
}: PaymentMethodSelectorProps) {
  // Use enabled methods from DB, or fallback to COD if nothing enabled
  const availableMethods =
    enabledMethods.length > 0 ? enabledMethods : FALLBACK_METHODS;

  // Auto-select first method if nothing selected
  useEffect(() => {
    if (!selectedMethod && availableMethods.length > 0) {
      const firstMethod = availableMethods[0];
      onMethodSelect({
        gateway: firstMethod.gateway,
        displayName: firstMethod.displayName,
        description: firstMethod.description,
      });
    }
  }, [selectedMethod, availableMethods, onMethodSelect]);

  // Show warning if no methods are available
  if (availableMethods.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription>
          No payment methods are available. Please contact the store.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <RadioGroup
        value={selectedMethod?.gateway || ""}
        onValueChange={(value) => {
          const method = availableMethods.find((m) => m.gateway === value);
          if (method) {
            onMethodSelect({
              gateway: method.gateway,
              displayName: method.displayName,
              description: method.description,
            });
          }
        }}
        disabled={disabled}
      >
        {availableMethods.map((method) => {
          const Icon = PAYMENT_ICONS[method.gateway] || CreditCard;
          const isSelected = selectedMethod?.gateway === method.gateway;
          const badge = PAYMENT_BADGES[method.gateway];

          return (
            <Label
              key={method.gateway}
              htmlFor={`payment-${method.gateway}`}
              className="block w-full cursor-pointer"
            >
              <Card
                className={cn(
                  "transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "hover:border-muted-foreground/50",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <RadioGroupItem
                    value={method.gateway}
                    id={`payment-${method.gateway}`}
                    disabled={disabled}
                    className="mt-1"
                  />
                  <div
                    className={cn(
                      "flex items-center justify-center size-10 rounded-full shrink-0",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{method.displayName}</p>
                      {badge && (
                        <span
                          className={cn(
                            "text-xs px-2 py-1 rounded-full shrink-0",
                            badge.variant === "recommended"
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-100 text-blue-700"
                          )}
                        >
                          {badge.text}
                        </span>
                      )}
                    </div>
                    {method.description && (
                      <p className="text-sm text-muted-foreground">
                        {method.description}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Label>
          );
        })}
      </RadioGroup>

      {/* Crypto network selector - shown when crypto_usdt is selected */}
      {selectedMethod?.gateway === "crypto_usdt" &&
        onNetworkSelect &&
        (() => {
          const cryptoGateway = availableMethods.find(
            (m) => m.gateway === "crypto_usdt"
          );
          const networks = cryptoGateway?.cryptoNetworks;
          if (!networks || networks.length <= 1) return null;
          return (
            <div className="rounded-lg border p-4 mt-3">
              <label className="text-sm font-medium">Select Network</label>
              <Select
                value={selectedNetwork || networks[0].network}
                onValueChange={onNetworkSelect}
                disabled={disabled}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select network" />
                </SelectTrigger>
                <SelectContent>
                  {networks.map((n) => (
                    <SelectItem key={n.network} value={n.network}>
                      {n.label} - Fees {n.feeHint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                Choose the network you&apos;ll use to send USDT. Lower fee
                networks are recommended.
              </p>
            </div>
          );
        })()}
    </div>
  );
}
