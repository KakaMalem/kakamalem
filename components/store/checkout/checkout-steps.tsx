"use client";

import { Check, MapPin, Truck, ClipboardList } from "lucide-react";
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
  { number: 1 as const, label: "Shipping", icon: MapPin },
  { number: 2 as const, label: "Delivery", icon: Truck },
  { number: 3 as const, label: "Review", icon: ClipboardList },
];

export function CheckoutSteps({
  currentStep,
  onStepClick,
  completedSteps,
}: CheckoutStepsProps) {
  return (
    <nav aria-label="Checkout progress" className="w-full">
      <div className="mx-auto max-w-md">
        <ol
          className="grid"
          style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}
        >
          {steps.map((step, index) => {
            const isActive = currentStep === step.number;
            const isCompleted = completedSteps[step.number];
            const isFirst = index === 0;
            const isLast = index === steps.length - 1;
            const isClickable =
              step.number < currentStep ||
              (step.number === 2 && completedSteps[1]) ||
              (step.number === 3 && completedSteps[1] && completedSteps[2]);

            // Connector states
            const prevCompleted =
              index > 0 && completedSteps[steps[index - 1].number];
            const currentCompleted = completedSteps[step.number];

            const Icon = step.icon;

            return (
              <li
                key={step.number}
                className="relative flex flex-col items-center"
              >
                {/* Connector line to the left (except first) */}
                {!isFirst && (
                  <div
                    className={cn(
                      "absolute left-0 top-5 h-0.5 w-[calc(50%-20px)] -translate-y-1/2",
                      prevCompleted ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}

                {/* Connector line to the right (except last) */}
                {!isLast && (
                  <div
                    className={cn(
                      "absolute right-0 top-5 h-0.5 w-[calc(50%-20px)] -translate-y-1/2",
                      currentCompleted ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}

                {/* Circle - always centered */}
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(step.number)}
                  disabled={!isClickable}
                  className={cn(
                    "relative z-10 flex items-center justify-center size-10 rounded-full border-2 transition-all",
                    isClickable ? "cursor-pointer" : "cursor-default",
                    isActive &&
                      "border-primary bg-primary text-primary-foreground ring-4 ring-primary/20",
                    isCompleted &&
                      !isActive &&
                      "border-primary bg-primary text-primary-foreground",
                    !isActive &&
                      !isCompleted &&
                      "border-muted-foreground/30 bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted && !isActive ? (
                    <Check className="size-5" />
                  ) : (
                    <Icon className="size-5" />
                  )}
                </button>

                {/* Label - always centered */}
                <span
                  className={cn(
                    "mt-2 text-sm transition-colors text-center",
                    isActive && "font-medium text-foreground",
                    isCompleted && !isActive && "text-foreground",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
