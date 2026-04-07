"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CURRENCY_SYMBOLS: Record<string, string> = { AFN: "؋" };

export interface MoneyInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "size"
> {
  /** Current value (number) */
  value: number | null;
  /** Called when value changes */
  onChange: (value: number | null) => void;
  /** Currency code to display (e.g., "AFN", "USD") */
  currency?: string;
  /** Minimum allowed value */
  min?: number;
  /** Maximum allowed value */
  max?: number;
  /** Quick amount buttons to show */
  quickAmounts?: number[];
  /** Show quick amount buttons */
  showQuickAmounts?: boolean;
  /** Label for "Full" button that sets value to max */
  fullAmountLabel?: string;
  /** Whether to show the full amount button */
  showFullAmount?: boolean;
  /** Size variant */
  inputSize?: "sm" | "default" | "lg";
}

/**
 * Money input component with formatting and quick amount buttons.
 * Designed for digitally illiterate users with large touch targets.
 */
const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    {
      className,
      value,
      onChange,
      currency = "AFN",
      min = 0,
      max,
      quickAmounts,
      showQuickAmounts = false,
      fullAmountLabel = "Full",
      showFullAmount = false,
      inputSize = "default",
      disabled,
      ...props
    },
    ref
  ) => {
    // Local state for the input string (allows typing decimals like "10.")
    const [inputValue, setInputValue] = React.useState<string>(
      value !== null ? formatDisplayValue(value) : ""
    );

    // Sync input value when external value changes
    React.useEffect(() => {
      if (value === null) {
        setInputValue("");
      } else {
        // Only update if the parsed value is different (avoid cursor jump)
        const currentParsed = parseInputValue(inputValue);
        if (currentParsed !== value) {
          setInputValue(formatDisplayValue(value));
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;

      // Allow empty input
      if (raw === "") {
        setInputValue("");
        onChange(null);
        return;
      }

      // Remove non-numeric characters except decimal point and comma
      const cleaned = raw.replace(/[^\d.,]/g, "");

      // Replace comma with decimal point
      const normalized = cleaned.replace(",", ".");

      // Only allow one decimal point
      const parts = normalized.split(".");
      const formatted =
        parts.length > 2
          ? `${parts[0]}.${parts.slice(1).join("")}`
          : normalized;

      // Limit decimal places to 2
      const decimalParts = formatted.split(".");
      const finalValue =
        decimalParts.length === 2
          ? `${decimalParts[0]}.${decimalParts[1].slice(0, 2)}`
          : formatted;

      setInputValue(finalValue);

      // Parse and validate
      const parsed = parseFloat(finalValue);
      if (!isNaN(parsed)) {
        let validValue = parsed;

        // Clamp to min/max
        if (min !== undefined) validValue = Math.max(min, validValue);
        if (max !== undefined) validValue = Math.min(max, validValue);

        onChange(validValue);
      } else if (finalValue === "" || finalValue === ".") {
        onChange(null);
      }
    };

    const handleBlur = () => {
      // Format the value on blur for cleaner display
      if (value !== null) {
        setInputValue(formatDisplayValue(value));
      }
    };

    const handleQuickAmount = (amount: number) => {
      let validValue = amount;
      if (min !== undefined) validValue = Math.max(min, validValue);
      if (max !== undefined) validValue = Math.min(max, validValue);

      setInputValue(formatDisplayValue(validValue));
      onChange(validValue);
    };

    const handleFullAmount = () => {
      if (max !== undefined) {
        setInputValue(formatDisplayValue(max));
        onChange(max);
      }
    };

    const sizeClasses = {
      sm: "h-9",
      default: "h-10",
      lg: "h-12 text-lg",
    };

    const buttonSizeClasses = {
      sm: "h-9 px-3",
      default: "h-10 px-4",
      lg: "h-12 px-5 text-base",
    };

    return (
      <div className="space-y-2">
        {/* Quick amount buttons */}
        {(showQuickAmounts || showFullAmount) && (
          <div className="flex flex-wrap gap-2">
            {showFullAmount && max !== undefined && (
              <Button
                type="button"
                variant={value === max ? "default" : "outline"}
                size="sm"
                className={cn(buttonSizeClasses[inputSize], "min-w-15")}
                onClick={handleFullAmount}
                disabled={disabled}
              >
                {fullAmountLabel}
              </Button>
            )}
            {showQuickAmounts &&
              quickAmounts?.map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  variant={value === amount ? "default" : "outline"}
                  size="sm"
                  className={cn(buttonSizeClasses[inputSize], "min-w-15")}
                  onClick={() => handleQuickAmount(amount)}
                  disabled={disabled}
                >
                  +{formatCompactNumber(amount)}
                </Button>
              ))}
          </div>
        )}

        {/* Input field */}
        <div className="relative">
          <Input
            ref={ref}
            type="text"
            inputMode="decimal"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            className={cn(
              sizeClasses[inputSize],
              "pr-14 font-medium tabular-nums",
              className
            )}
            disabled={disabled}
            {...props}
          />
          <span
            className={cn(
              "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground",
              inputSize === "lg" ? "text-base" : "text-sm"
            )}
          >
            {CURRENCY_SYMBOLS[currency] ?? currency}
          </span>
        </div>
      </div>
    );
  }
);
MoneyInput.displayName = "MoneyInput";

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatDisplayValue(value: number): string {
  // Format with thousand separators for display
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function parseInputValue(input: string): number | null {
  // Remove thousand separators and parse
  const cleaned = input.replace(/,/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

function formatCompactNumber(num: number): string {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k`;
  }
  return num.toString();
}

export { MoneyInput };
