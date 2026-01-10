"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckoutStepsProps {
  currentStep: 1 | 2 | 3;
  onStepClick: (step: 1 | 2 | 3) => void;
  completedSteps: {
    1: boolean;
    2: boolean;
    3: boolean;
  };
}

const steps = [
  { number: 1 as const, label: "Shipping" },
  { number: 2 as const, label: "Delivery" },
  { number: 3 as const, label: "Review" },
];

export function CheckoutSteps({
  currentStep,
  onStepClick,
  completedSteps,
}: CheckoutStepsProps) {
  return (
    <nav aria-label="Checkout progress">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isActive = currentStep === step.number;
          const isCompleted = completedSteps[step.number];
          const isClickable =
            step.number < currentStep ||
            (step.number === 2 && completedSteps[1]) ||
            (step.number === 3 && completedSteps[1] && completedSteps[2]);

          return (
            <li
              key={step.number}
              className={cn("flex items-center", index > 0 && "flex-1")}
            >
              {/* Connector line */}
              {index > 0 && (
                <div
                  className={cn(
                    "h-0.5 w-full",
                    completedSteps[steps[index - 1].number]
                      ? "bg-primary"
                      : "bg-muted"
                  )}
                />
              )}

              {/* Step indicator */}
              <button
                type="button"
                onClick={() => isClickable && onStepClick(step.number)}
                disabled={!isClickable}
                className={cn(
                  "relative flex items-center justify-center",
                  isClickable && "cursor-pointer",
                  !isClickable && "cursor-default"
                )}
              >
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                    isActive && "bg-primary text-primary-foreground",
                    isCompleted &&
                      !isActive &&
                      "bg-primary text-primary-foreground",
                    !isActive &&
                      !isCompleted &&
                      "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted && !isActive ? (
                    <Check className="size-5" />
                  ) : (
                    step.number
                  )}
                </span>
                <span
                  className={cn(
                    "absolute -bottom-6 whitespace-nowrap text-sm",
                    isActive && "font-medium text-foreground",
                    !isActive && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
