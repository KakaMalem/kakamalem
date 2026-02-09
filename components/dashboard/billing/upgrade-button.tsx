"use client";

import { type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonProps = ComponentProps<typeof Button>;

interface UpgradeButtonProps extends Omit<ButtonProps, "onClick"> {
  /** Store slug for navigation to upgrade page */
  storeSlug: string;
  /** Custom button text */
  children?: React.ReactNode;
}

export function UpgradeButton({
  storeSlug,
  children,
  className,
  size = "sm",
  ...props
}: UpgradeButtonProps) {
  const router = useRouter();

  const handleUpgrade = () => {
    // Navigate to upgrade page for payment method selection
    router.push(`/dashboard/${storeSlug}/billing/upgrade`);
  };

  return (
    <Button
      size={size}
      onClick={handleUpgrade}
      className={cn(className)}
      {...props}
    >
      {children || (
        <>
          <Crown className="mr-1.5 size-3.5" />
          Upgrade to Pro
        </>
      )}
    </Button>
  );
}
