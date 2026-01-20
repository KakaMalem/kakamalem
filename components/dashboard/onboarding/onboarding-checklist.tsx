"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Rocket, X, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChecklistItem } from "./checklist-item";
import { dismissOnboardingAction } from "@/lib/actions/onboarding";
import type { OnboardingChecklist as OnboardingChecklistType } from "@/lib/db/schema";

interface OnboardingChecklistProps {
  storeSlug: string;
  checklist: OnboardingChecklistType;
}

export function OnboardingChecklist({
  storeSlug,
  checklist,
}: OnboardingChecklistProps) {
  const [isDismissed, setIsDismissed] = useState(checklist.isDismissed);
  const [isPending, startTransition] = useTransition();

  if (isDismissed) return null;

  const progress = (checklist.completedCount / checklist.totalCount) * 100;
  const isComplete = checklist.completedCount === checklist.totalCount;

  const handleDismiss = () => {
    startTransition(async () => {
      const result = await dismissOnboardingAction(storeSlug);
      if (result.success) {
        setIsDismissed(true);
      }
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {isComplete ? (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                >
                  <PartyPopper className="size-5 text-primary" />
                </motion.div>
              ) : (
                <Rocket className="size-5 text-primary" />
              )}
              <CardTitle className="text-base">
                {isComplete ? "All done!" : "Getting Started"}
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 -mr-2 -mt-1"
              onClick={handleDismiss}
              disabled={isPending}
            >
              <X className="size-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          </div>
          <CardDescription>
            {isComplete
              ? "Congratulations! Your store is ready to go."
              : "Complete these steps to set up your store"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress bar */}
          <div className="space-y-1.5">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {checklist.completedCount} of {checklist.totalCount} completed
            </p>
          </div>

          {/* Checklist items */}
          <div className="space-y-2">
            {checklist.items.map((item, index) => (
              <ChecklistItem key={item.id} item={item} index={index} />
            ))}
          </div>

          {/* Completion celebration */}
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center py-2"
            >
              <Button variant="outline" size="sm" onClick={handleDismiss}>
                Dismiss checklist
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
