"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MapPin, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateCheckoutAddressMode } from "@/lib/actions/stores";

interface CheckoutAddressModeToggleProps {
  tenantId: string;
  storeSlug: string;
  currentMode: "gps" | "standard_form";
}

const modes = [
  {
    value: "gps" as const,
    label: "GPS Delivery",
    description:
      "Customers pin their location on a map. Best for local delivery in areas without reliable postal addresses.",
    icon: MapPin,
  },
  {
    value: "standard_form" as const,
    label: "Standard Address Form",
    description:
      "Customers fill in street, city, state, postal code, and country. Best for standard shipping & dropshipping.",
    icon: FileText,
  },
];

export function CheckoutAddressModeToggle({
  tenantId,
  storeSlug,
  currentMode,
}: CheckoutAddressModeToggleProps) {
  const [selected, setSelected] = useState(currentMode);
  const [isPending, startTransition] = useTransition();

  const handleSelect = (mode: "gps" | "standard_form") => {
    if (mode === selected || isPending) return;

    setSelected(mode);
    startTransition(async () => {
      const result = await updateCheckoutAddressMode(tenantId, storeSlug, mode);
      if (result.error) {
        setSelected(currentMode); // revert
        toast.error(result.error.message);
      } else {
        toast.success(
          mode === "gps"
            ? "Switched to GPS delivery mode"
            : "Switched to standard address form"
        );
      }
    });
  };

  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-muted/30">
        <h3 className="font-semibold">Checkout Address Mode</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Choose how customers provide their delivery address at checkout
        </p>
      </div>
      <div className="p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const isSelected = selected === mode.value;

            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => handleSelect(mode.value)}
                disabled={isPending}
                className={cn(
                  "relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all",
                  "hover:bg-muted/50",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-muted",
                  isPending && "opacity-60 cursor-not-allowed"
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="size-4.5" />
                  </div>
                  <span className="font-medium text-sm">{mode.label}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {mode.description}
                </p>
                {/* Radio indicator */}
                <div
                  className={cn(
                    "absolute top-3 right-3 size-4 rounded-full border-2 transition-colors",
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/30"
                  )}
                >
                  {isSelected && (
                    <div className="size-full rounded-full flex items-center justify-center">
                      <div className="size-1.5 rounded-full bg-primary-foreground" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
