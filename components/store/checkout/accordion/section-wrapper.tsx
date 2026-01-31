"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, Lock, type LucideIcon } from "lucide-react";
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
  const isLocked = status === "locked";
  const isCompleted = status === "completed";
  const isActive = status === "active" || isExpanded;

  const handleClick = () => {
    if (isLocked) return;
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
        isLocked && "opacity-60 cursor-not-allowed",
        isActive && "border-primary/50 shadow-sm",
        isCompleted && !isExpanded && "border-muted"
      )}
    >
      {/* Header */}
      <div className="flex items-center">
        <div
          role="button"
          tabIndex={isLocked ? -1 : 0}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleClick();
            }
          }}
          className={cn(
            "flex-1 flex items-center gap-4 p-4 text-left transition-colors",
            !isLocked && "hover:bg-muted/50 cursor-pointer",
            isLocked && "cursor-not-allowed"
          )}
          aria-expanded={isExpanded}
          aria-controls={`section-content-${section}`}
          aria-disabled={isLocked}
        >
          {/* Step indicator */}
          <motion.div
            initial={false}
            animate={{
              scale: isActive ? 1.05 : 1,
              backgroundColor:
                isCompleted || isActive
                  ? "hsl(var(--primary))"
                  : isLocked
                    ? "hsl(var(--muted))"
                    : "hsl(var(--muted))",
            }}
            transition={{ duration: 0.2 }}
            className={cn(
              "flex items-center justify-center size-10 rounded-full shrink-0 transition-colors",
              isCompleted || isActive
                ? "text-primary-foreground"
                : "text-muted-foreground"
            )}
          >
            {isCompleted && !isExpanded ? (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                <Check className="size-5" />
              </motion.div>
            ) : isLocked ? (
              <Lock className="size-4" />
            ) : (
              <span className="text-sm font-semibold">{stepNumber}</span>
            )}
          </motion.div>

          {/* Title and summary */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              />
              <h3
                className={cn(
                  "font-medium",
                  isLocked && "text-muted-foreground"
                )}
              >
                {title}
              </h3>
            </div>

            {/* Summary (shown when collapsed and completed) */}
            {isCompleted && !isExpanded && summary && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-1 text-sm text-muted-foreground truncate"
              >
                {summary}
              </motion.div>
            )}
          </div>

          {/* Chevron indicator */}
          {!isLocked && (
            <ChevronDown
              className={cn(
                "size-5 shrink-0 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-180"
              )}
            />
          )}
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
