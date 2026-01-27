"use client";

import { Button } from "@/components/ui/button";
import { Delete, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface NumpadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  maxValue?: number;
  allowDecimal?: boolean;
  className?: string;
}

export function Numpad({
  value,
  onChange,
  onSubmit,
  maxValue,
  allowDecimal = true,
  className,
}: NumpadProps) {
  const handleDigit = (digit: string) => {
    // Prevent multiple decimals
    if (digit === "." && value.includes(".")) return;

    // Prevent leading zeros (except for decimal)
    if (value === "0" && digit !== ".") {
      onChange(digit);
      return;
    }

    const newValue = value + digit;

    // Check max value
    if (maxValue !== undefined) {
      const numValue = parseFloat(newValue);
      if (!isNaN(numValue) && numValue > maxValue) return;
    }

    // Limit decimal places to 2
    if (newValue.includes(".")) {
      const [, decimal] = newValue.split(".");
      if (decimal && decimal.length > 2) return;
    }

    onChange(newValue);
  };

  const handleBackspace = () => {
    if (value.length <= 1) {
      onChange("0");
    } else {
      onChange(value.slice(0, -1));
    }
  };

  const handleClear = () => {
    onChange("0");
  };

  const buttons = [
    ["7", "8", "9"],
    ["4", "5", "6"],
    ["1", "2", "3"],
    [allowDecimal ? "." : "C", "0", "backspace"],
  ];

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {/* Clear button (top row) */}
      <Button
        type="button"
        variant="outline"
        className="col-span-2 h-14 text-xl font-medium"
        onClick={handleClear}
      >
        Clear
      </Button>
      <Button
        type="button"
        variant="destructive"
        className="h-14"
        onClick={handleBackspace}
      >
        <Delete className="size-6" />
      </Button>

      {/* Number grid */}
      {buttons.map((row, rowIndex) =>
        row.map((btn) => {
          if (btn === "backspace") {
            return (
              <Button
                key={`${rowIndex}-${btn}`}
                type="button"
                variant="outline"
                className="h-16 text-2xl font-medium"
                onClick={handleBackspace}
              >
                <Delete className="size-6" />
              </Button>
            );
          }
          if (btn === "C") {
            return (
              <Button
                key={`${rowIndex}-${btn}`}
                type="button"
                variant="outline"
                className="h-16 text-xl font-medium"
                onClick={handleClear}
              >
                C
              </Button>
            );
          }
          return (
            <Button
              key={`${rowIndex}-${btn}`}
              type="button"
              variant="outline"
              className="h-16 text-2xl font-medium active:bg-primary active:text-primary-foreground"
              onClick={() => handleDigit(btn)}
            >
              {btn}
            </Button>
          );
        })
      )}

      {/* Submit button */}
      {onSubmit && (
        <Button
          type="button"
          className="col-span-3 h-16 text-xl font-medium"
          onClick={onSubmit}
        >
          <Check className="mr-2 size-6" />
          Confirm
        </Button>
      )}
    </div>
  );
}
