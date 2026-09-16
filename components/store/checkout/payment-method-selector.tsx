"use client";

import { useEffect } from "react";
import {
  CreditCard,
  Banknote,
  Building2,
  Smartphone,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { getCurrencyMeta } from "@/lib/currency/currencies";
import type { PaymentMethod } from "@/lib/stores/use-checkout-store";
import type { EnabledGateway } from "@/lib/payments/types";

const PAYMENT_ICONS: Record<string, typeof CreditCard> = {
  hesabpay: CreditCard,
  cod: Banknote,
  bank_transfer: Building2,
  mobile_money: Smartphone,
};

const PAYMENT_BADGES: Record<
  string,
  { text: string; variant: "recommended" | "info" } | null
> = {
  hesabpay: { text: "Recommended", variant: "recommended" },
  cod: null,
  bank_transfer: null,
  mobile_money: null,
};

// Fallback if the store hasn't configured any payment methods yet
const FALLBACK_METHODS: EnabledGateway[] = [
  {
    gateway: "hesabpay",
    displayName: "Pay with Card (HesabPay)",
    description: "Secure payment via HesabPay",
    displayOrder: 0,
  },
  {
    gateway: "cod",
    displayName: "Cash on Delivery",
    description: "Pay when your order arrives",
    displayOrder: 1,
  },
];

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod | null;
  onMethodSelect: (method: PaymentMethod) => void;
  disabled?: boolean;
  currency: string;
  enabledMethods: EnabledGateway[];
}

export function PaymentMethodSelector({
  selectedMethod,
  onMethodSelect,
  disabled = false,
  currency,
  enabledMethods,
}: PaymentMethodSelectorProps) {
  const availableMethods =
    enabledMethods.length > 0 ? enabledMethods : FALLBACK_METHODS;

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
                    className="sr-only"
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
                    {method.chargeCurrency &&
                      method.chargeCurrency !== currency &&
                      method.chargeExchangeRate && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Charged in{" "}
                          {getCurrencyMeta(method.chargeCurrency).label} at 1{" "}
                          {currency} ={" "}
                          {getCurrencyMeta(method.chargeCurrency).symbol}
                          {method.chargeExchangeRate.toLocaleString("en-US", {
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      )}
                  </div>
                </CardContent>
              </Card>
            </Label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
