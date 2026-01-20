"use client";

import { motion } from "framer-motion";
import { Globe, Store, ShoppingBag, Images, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoreMode } from "@/lib/config/onboarding";

const STORE_TYPE_OPTIONS: {
  mode: StoreMode;
  title: string;
  description: string;
  icon: typeof Globe;
  recommended?: boolean;
}[] = [
  {
    mode: "online_only",
    title: "Online Store",
    description: "Sell products through your website with online checkout",
    icon: Globe,
    recommended: true,
  },
  {
    mode: "offline_only",
    title: "Physical Store",
    description: "Record in-person sales with point of sale",
    icon: Store,
  },
  {
    mode: "full",
    title: "Both (Omnichannel)",
    description: "Online store + in-person sales recording",
    icon: ShoppingBag,
  },
  {
    mode: "catalog",
    title: "Catalog Only",
    description: "Showcase products, customers contact you to order",
    icon: Images,
  },
];

interface StepStoreTypeProps {
  value: StoreMode;
  onChange: (mode: StoreMode) => void;
  disabled?: boolean;
}

export function StepStoreType({
  value,
  onChange,
  disabled,
}: StepStoreTypeProps) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-base font-medium">
          What kind of store are you creating?
        </h3>
        <p className="text-sm text-muted-foreground">
          This helps us personalize your setup experience
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {STORE_TYPE_OPTIONS.map((option, index) => {
          const isSelected = value === option.mode;
          const Icon = option.icon;

          return (
            <motion.button
              key={option.mode}
              type="button"
              onClick={() => !disabled && onChange(option.mode)}
              disabled={disabled}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              className={cn(
                "relative flex flex-col items-start gap-3 rounded-xl border-2 p-4 text-left transition-all",
                "hover:border-primary/50 hover:bg-muted/50",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/20",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {/* Recommended badge */}
              {option.recommended && (
                <span className="absolute -top-2.5 left-3 bg-primary text-primary-foreground text-[10px] font-medium px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              )}

              {/* Selection indicator */}
              <motion.div
                initial={false}
                animate={{
                  scale: isSelected ? 1 : 0,
                  opacity: isSelected ? 1 : 0,
                }}
                className="absolute top-3 right-3"
              >
                <div className="size-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="size-3 text-primary-foreground" />
                </div>
              </motion.div>

              {/* Icon */}
              <div
                className={cn(
                  "p-2.5 rounded-lg transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="size-5" />
              </div>

              {/* Content */}
              <div className="space-y-1 pr-6">
                <h4 className="font-medium text-sm">{option.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {option.description}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center mt-4">
        You can change this later in your store settings
      </p>
    </div>
  );
}
