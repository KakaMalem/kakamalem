"use client";

import * as React from "react";
import { AlertTriangle, ArrowRight, Check, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ConfirmationDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Dialog title */
  title: string;
  /** Dialog description */
  description?: string;
  /** Type of action (affects styling) */
  variant?: "default" | "destructive" | "warning";
  /** Before state to show in comparison */
  before?: {
    label: string;
    value: string;
    subtext?: string;
  };
  /** After state to show in comparison */
  after?: {
    label: string;
    value: string;
    subtext?: string;
    highlight?: "positive" | "negative" | "neutral";
  };
  /** Custom content to show instead of before/after */
  children?: React.ReactNode;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Whether confirm action is loading */
  isLoading?: boolean;
  /** Called when confirm is clicked */
  onConfirm: () => void;
  /** Called when cancel is clicked */
  onCancel?: () => void;
}

/**
 * Confirmation dialog with optional before/after preview.
 * Designed for financial actions where users need to see the impact.
 */
export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  variant = "default",
  before,
  after,
  children,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleConfirm = () => {
    onConfirm();
  };

  const variantStyles = {
    default: {
      icon: Check,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      confirmVariant: "default" as const,
    },
    destructive: {
      icon: X,
      iconBg: "bg-destructive/10",
      iconColor: "text-destructive",
      confirmVariant: "destructive" as const,
    },
    warning: {
      icon: AlertTriangle,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      confirmVariant: "default" as const,
    },
  };

  const styles = variantStyles[variant];
  const Icon = styles.icon;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-full",
                styles.iconBg
              )}
            >
              <Icon className={cn("size-6", styles.iconColor)} />
            </div>
            <div className="space-y-1">
              <AlertDialogTitle className="text-lg">{title}</AlertDialogTitle>
              {description && (
                <AlertDialogDescription>{description}</AlertDialogDescription>
              )}
            </div>
          </div>
        </AlertDialogHeader>

        {/* Before/After Comparison */}
        {(before || after) && (
          <div className="my-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-4">
              {/* Before */}
              {before && (
                <div className="flex-1 text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    {before.label}
                  </p>
                  <p className="text-lg font-semibold">{before.value}</p>
                  {before.subtext && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {before.subtext}
                    </p>
                  )}
                </div>
              )}

              {/* Arrow */}
              {before && after && (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <ArrowRight className="size-4 text-muted-foreground" />
                </div>
              )}

              {/* After */}
              {after && (
                <div className="flex-1 text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    {after.label}
                  </p>
                  <p
                    className={cn(
                      "text-lg font-semibold",
                      after.highlight === "positive" && "text-green-600",
                      after.highlight === "negative" && "text-red-600"
                    )}
                  >
                    {after.value}
                  </p>
                  {after.subtext && (
                    <p
                      className={cn(
                        "text-xs mt-0.5",
                        after.highlight === "positive"
                          ? "text-green-600"
                          : after.highlight === "negative"
                            ? "text-red-600"
                            : "text-muted-foreground"
                      )}
                    >
                      {after.subtext}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Custom Content */}
        {children && <div className="my-4">{children}</div>}

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel asChild>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
              className="h-11"
            >
              {cancelText}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant={styles.confirmVariant}
              onClick={handleConfirm}
              disabled={isLoading}
              className="h-11 min-w-24"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Processing...
                </span>
              ) : (
                confirmText
              )}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Hook to manage confirmation dialog state
 */
export function useConfirmationDialog() {
  const [state, setState] = React.useState<{
    open: boolean;
    props: Partial<ConfirmationDialogProps>;
    resolve: ((confirmed: boolean) => void) | null;
  }>({
    open: false,
    props: {},
    resolve: null,
  });

  const confirm = React.useCallback(
    (
      props: Omit<
        ConfirmationDialogProps,
        "open" | "onOpenChange" | "onConfirm"
      >
    ) => {
      return new Promise<boolean>((resolve) => {
        setState({
          open: true,
          props,
          resolve,
        });
      });
    },
    []
  );

  const handleConfirm = React.useCallback(() => {
    state.resolve?.(true);
    setState((prev) => ({ ...prev, open: false, resolve: null }));
  }, [state]);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        state.resolve?.(false);
      }
      setState((prev) => ({
        ...prev,
        open,
        resolve: open ? prev.resolve : null,
      }));
    },
    [state]
  );

  const dialogProps: ConfirmationDialogProps = {
    open: state.open,
    onOpenChange: handleOpenChange,
    onConfirm: handleConfirm,
    title: state.props.title || "",
    ...state.props,
  };

  return { confirm, dialogProps };
}
