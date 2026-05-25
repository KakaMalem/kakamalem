"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { SubscriptionOverview } from "@/lib/db/queries/billing";
import { cancelSubscription } from "@/lib/actions/subscriptions";

interface SubscriptionActionsProps {
  subscription: SubscriptionOverview;
  tenantId: string;
}

export function SubscriptionActions({
  subscription,
  tenantId,
}: SubscriptionActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const isPro = subscription.plan === "pro";
  const isActive =
    subscription.status === "active" || subscription.status === "past_due";

  if (!isPro || !isActive) return null;

  async function handleCancel() {
    setLoading("cancel");
    try {
      const result = await cancelSubscription(tenantId);

      if (result.success) {
        toast.success(
          "Subscription cancelled. You'll keep Pro access until the end of your billing period."
        );
        router.refresh();
      } else {
        toast.error(result.error || "Failed to cancel subscription");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={loading !== null}
          >
            Cancel Subscription
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your Pro subscription?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Your subscription will be cancelled at the end of your current
                billing period.
              </span>
              {subscription.daysRemainingInPeriod !== null &&
                subscription.daysRemainingInPeriod > 0 && (
                  <span className="block font-medium text-foreground">
                    You&apos;ll keep Pro access for{" "}
                    {subscription.daysRemainingInPeriod} more day
                    {subscription.daysRemainingInPeriod !== 1 ? "s" : ""}.
                  </span>
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={loading === "cancel"}
            >
              {loading === "cancel" && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
