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
    <div className="flex items-center gap-6">
      <h4 className="text-lg font-semibold">{label}:</h4>
      <RadioGroup
        value={selectedValue}
        onValueChange={onValueChange}
        className="flex gap-3"
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "border-input group relative flex flex-col items-center gap-3 rounded-md border px-3 py-1.5 text-center shadow-xs transition-[color,box-shadow] outline-none cursor-pointer",
              "has-focus-visible:border-ring has-focus-visible:ring-ring/50 has-focus-visible:ring-[3px]",
              "has-data-disabled:cursor-not-allowed has-data-disabled:opacity-50",
              "has-data-[state=checked]:bg-primary has-data-[state=checked]:border-primary"
            )}
          >
            <RadioGroupItem
              value={option.value}
              id={`option-${option.value}`}
              aria-label={`option-radio-${option.value}`}
              disabled={!option.isAvailable}
              className="sr-only after:absolute after:inset-0"
            />
            <p className="text-foreground group-has-data-[state=checked]:text-primary-foreground text-sm leading-none font-medium">
              {option.label}
            </p>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
