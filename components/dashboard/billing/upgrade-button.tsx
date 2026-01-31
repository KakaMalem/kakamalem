"use client";

import { useState, type ComponentProps } from "react";
import { Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initiateProUpgrade } from "@/lib/actions/subscriptions";
import { useSubscriptionTenantId } from "@/lib/stores/use-subscription-store";
import { cn } from "@/lib/utils";

type ButtonProps = ComponentProps<typeof Button>;

interface UpgradeButtonProps extends Omit<ButtonProps, "onClick"> {
  /** Override tenantId (uses subscription store by default) */
  tenantId?: string;
  /** Custom button text */
  children?: React.ReactNode;
  /** Callback when upgrade starts */
  onUpgradeStart?: () => void;
  /** Callback on upgrade error */
  onUpgradeError?: (error: string) => void;
}

export function UpgradeButton({
  tenantId: propTenantId,
  children,
  onUpgradeStart,
  onUpgradeError,
  className,
  size = "sm",
  ...props
}: UpgradeButtonProps) {
  const storeTenantId = useSubscriptionTenantId();
  const tenantId = propTenantId || storeTenantId;

  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!tenantId) {
      onUpgradeError?.("Store not found");
      return;
    }

    setIsLoading(true);
    onUpgradeStart?.();

    try {
      const result = await initiateProUpgrade(tenantId);

      if (result.success && result.paymentUrl) {
        // Redirect to HesabPay payment page
        window.location.href = result.paymentUrl;
      } else {
        onUpgradeError?.(result.error || "Failed to start upgrade");
        setIsLoading(false);
      }
    } catch (_err) {
      onUpgradeError?.("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <Button
      size={size}
      onClick={handleUpgrade}
      disabled={isLoading || !tenantId}
      className={cn(className)}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          Processing...
        </>
      ) : (
        children || (
          <>
            <Crown className="mr-1.5 size-3.5" />
            Upgrade to Pro
          </>
        )
      )}
    </Button>
  );
}
