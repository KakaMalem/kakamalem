"use client";

import { motion } from "framer-motion";
import { Check, Layers, Store, Palette, Settings, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { id: 0, title: "Store Type", icon: Layers, optional: false },
  { id: 1, title: "Basic Info", icon: Store, optional: false },
  { id: 2, title: "Branding", icon: Palette, optional: true },
  { id: 3, title: "Contact", icon: Settings, optional: true },
  { id: 4, title: "Location", icon: MapPin, optional: true },
];

interface StepIndicatorProps {
  currentStep: number;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, index) => {
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;
        const Icon = step.icon;

        return (
          <div key={step.id} className="flex items-center">
            <motion.div
              initial={false}
              animate={{ scale: isActive ? 1.1 : 1 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : isCompleted
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30 bg-muted text-muted-foreground"
              )}
            >
              {isCompleted ? (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                >
                  <Check className="h-5 w-5" strokeWidth={3} />
                </motion.div>
              ) : (
                <Icon className="h-5 w-5" />
              )}
            </motion.div>

            {index < steps.length - 1 && (
              <div className="relative w-12 h-0.5 mx-2 bg-muted-foreground/30 overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: isCompleted ? "100%" : "0%" }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function StepTitle({ currentStep }: { currentStep: number }) {
  const step = steps[currentStep];
  return (
    <motion.div
      key={currentStep}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="text-center"
    >
      <h2 className="text-lg font-semibold">
        Step {currentStep + 1}: {step.title}
        {step.optional && (
          <span className="text-muted-foreground font-normal text-sm ml-2">
            (Optional)
          </span>
        )}
      </h2>
    </motion.div>
  );
}
