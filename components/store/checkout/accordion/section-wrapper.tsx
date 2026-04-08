"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type {
  CheckoutSection,
  SectionStatus,
} from "@/lib/stores/use-checkout-store";

interface SectionWrapperProps {
  section: CheckoutSection;
  stepNumber: 1 | 2 | 3 | 4;
  title: string;
  icon: LucideIcon;
  status: SectionStatus;
  summary?: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  children: React.ReactNode;
}

export function SectionWrapper({
  section,
  stepNumber,
  title,
  icon: Icon,
  status,
  summary,
  isExpanded,
  onToggle,
  onEdit,
  children,
}: SectionWrapperProps) {
  const isCompleted = status === "completed";
  const isActive = status === "active" || isExpanded;

  const handleClick = () => {
    onToggle();
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.();
  };

  return (
    <div
      data-section={section}
      data-status={status}
      className={cn(
        "rounded-lg border bg-card transition-all duration-200",
        isActive && "border-primary shadow-sm",
        !isActive && "border-border"
      )}
    >
      {/* Header */}
      <div className="flex items-center">
        <div
          role="button"
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleClick();
            }
          }}
          className="flex-1 flex items-center gap-3 p-3 sm:gap-4 sm:p-4 text-left transition-colors hover:bg-muted/50 cursor-pointer"
          aria-expanded={isExpanded}
          aria-controls={`section-content-${section}`}
        >
          {/* Step indicator */}
          <div
            className={cn(
              "flex items-center justify-center size-8 sm:size-10 rounded-full shrink-0 transition-all duration-200",
              // Active or completed: primary background with white text
              (isCompleted || isActive) && "bg-primary text-primary-foreground",
              // Incomplete: muted background with muted text
              !isCompleted && !isActive && "bg-muted text-muted-foreground",
              // Scale up when active
              isActive && "scale-105"
            )}
          >
            {isCompleted && !isExpanded ? (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                <Check className="size-5" strokeWidth={3} />
              </motion.div>
            ) : (
              <span className="text-sm font-semibold">{stepNumber}</span>
            )}
          </div>

          {/* Title and summary */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <h3 className="font-semibold text-sm sm:text-base truncate">
                  {title}
                </h3>
              </div>
              {isCompleted && !isExpanded && (
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-50 px-1.5 py-0.5 rounded sm:hidden">
                  Done
                </span>
              )}
            </div>

            {/* Summary (shown when collapsed and completed) */}
            {isCompleted && !isExpanded && summary && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-0.5 text-xs sm:text-sm text-muted-foreground truncate leading-relaxed max-w-55 sm:max-w-none"
              >
                {summary}
              </motion.div>
            )}
          </div>

          {/* Chevron indicator */}
          <ChevronDown
            className={cn(
              "size-5 shrink-0 text-muted-foreground transition-transform duration-200",
              isExpanded && "rotate-180"
            )}
          />
        </div>

        {/* Edit button - outside the clickable header to avoid nested interactive elements */}
        {isCompleted && !isExpanded && onEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            className="shrink-0 mr-4"
          >
            Edit
          </Button>
        )}
      </div>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            id={`section-content-${section}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0">
              {/* Divider */}
              <div className="border-t mb-4" />
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
