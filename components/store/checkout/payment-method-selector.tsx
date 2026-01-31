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
import type { PaymentMethod } from "@/lib/stores/use-checkout-store";
import type { EnabledGateway } from "@/lib/payments/types";

// Icons for each payment method (using string index for flexibility)
const PAYMENT_ICONS: Record<string, typeof CreditCard> = {
  hesabpay: CreditCard,
  stripe: CreditCard,
  cod: Banknote,
  bank_transfer: Building2,
  mobile_money: Smartphone,
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
}

export function PaymentMethodSelector({
  selectedMethod,
  onMethodSelect,
  disabled = false,
  enabledMethods,
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
          const isHesabPay = method.gateway === "hesabpay";

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
                <CardContent className="flex items-center gap-4 p-4">
                  <RadioGroupItem
                    value={method.gateway}
                    id={`payment-${method.gateway}`}
                    disabled={disabled}
                  />
                  <div
                    className={cn(
                      "flex items-center justify-center size-10 rounded-full",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{method.displayName}</p>
                    {method.description && (
                      <p className="text-sm text-muted-foreground">
                        {method.description}
                      </p>
                    )}
                  </div>
                  {isHesabPay && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      Recommended
                    </span>
                  )}
                </CardContent>
              </Card>
            </Label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
