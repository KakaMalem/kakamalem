"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Check, Circle, ExternalLink, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { completeOnboardingItemAction } from "@/lib/actions/onboarding";
import type { OnboardingChecklistItem } from "@/lib/db/schema";

interface ChecklistItemProps {
  item: OnboardingChecklistItem;
  index: number;
  storeSlug: string;
}

export function ChecklistItem({ item, index, storeSlug }: ChecklistItemProps) {
  const isExternal = item.href.startsWith("/store/");

  const handleClick = () => {
    // Mark "share_store" as complete when clicked (external link to store page)
    if (item.id === "share_store" && !item.completed) {
      completeOnboardingItemAction(storeSlug, item.id).catch(() => {
        // Silently ignore - onboarding completion is not critical
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
    >
      <Link
        href={item.href}
        target={isExternal ? "_blank" : undefined}
        onClick={handleClick}
        className={cn(
          "group flex items-start gap-3 rounded-lg border p-3 transition-all",
          item.completed
            ? "bg-muted/30 border-muted"
            : "hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        {/* Checkbox */}
        <div className="mt-0.5">
          {item.completed ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Check className="size-3" />
            </motion.div>
          ) : (
            <Circle className="size-5 text-muted-foreground/50 group-hover:text-primary/50 transition-colors" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-medium leading-tight",
              item.completed && "text-muted-foreground line-through"
            )}
          >
            {item.label}
          </p>
          <p
            className={cn(
              "text-xs mt-0.5 leading-tight",
              item.completed
                ? "text-muted-foreground/70"
                : "text-muted-foreground"
            )}
          >
            {item.description}
          </p>
        </div>

        {/* Arrow */}
        {!item.completed && (
          <div className="flex items-center text-muted-foreground/50 group-hover:text-primary transition-colors">
            {isExternal ? (
              <ExternalLink className="size-4" />
            ) : (
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            )}
          </div>
        )}
      </Link>
    </motion.div>
  );
}
