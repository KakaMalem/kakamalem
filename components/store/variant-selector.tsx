"use client";

import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface VariantOption {
  label: string;
  value: string;
  isAvailable: boolean;
}

interface VariantSelectorProps {
  label: string;
  options: VariantOption[];
  selectedValue: string;
  onValueChange: (value: string) => void;
}

export function VariantSelector({
  label,
  options,
  selectedValue,
  onValueChange,
}: VariantSelectorProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">{label}</h4>
      <RadioGroup
        value={selectedValue}
        onValueChange={onValueChange}
        className="flex flex-wrap gap-2"
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "group relative flex items-center justify-center",
              "min-h-11 min-w-11 px-4 py-2.5",
              "rounded-lg border-2 text-center cursor-pointer",
              "transition-all duration-200 active:scale-95",
              // Default state
              "border-border bg-background hover:border-primary/50 hover:bg-primary/5",
              // Focus state
              "has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2",
              // Disabled state
              "has-data-disabled:cursor-not-allowed has-data-disabled:opacity-40 has-data-disabled:line-through",
              // Selected state
              "has-data-[state=checked]:bg-primary has-data-[state=checked]:border-primary has-data-[state=checked]:shadow-sm"
            )}
          >
            <RadioGroupItem
              value={option.value}
              id={`option-${label}-${option.value}`}
              aria-label={`${label}: ${option.value}`}
              disabled={!option.isAvailable}
              className="sr-only after:absolute after:inset-0"
            />
            <span
              className={cn(
                "text-sm font-medium leading-none",
                "group-has-data-[state=checked]:text-primary-foreground"
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
