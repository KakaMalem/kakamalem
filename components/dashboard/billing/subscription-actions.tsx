"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ExternalLink } from "lucide-react";
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
import {
  cancelProSubscription,
  resumeProSubscription,
  openCustomerPortal,
} from "@/lib/actions/stripe-subscriptions";
import { cancelNonStripeSubscription } from "@/lib/actions/subscriptions";

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
  const isCancelled = subscription.status === "cancelled";
  const hasStripe = subscription.hasStripeSubscription;

  // Don't show actions for free/expired/trialing users
  if (!isPro) return null;

  async function handleCancel() {
    setLoading("cancel");
    try {
      const result = hasStripe
        ? await cancelProSubscription(tenantId)
        : await cancelNonStripeSubscription(tenantId);

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

  async function handleResume() {
    setLoading("resume");
    try {
      if (hasStripe) {
        const result = await resumeProSubscription(tenantId);
        if (result.success) {
          toast.success("Subscription resumed!");
          router.refresh();
        } else {
          toast.error(result.error || "Failed to resume subscription");
        }
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  async function handleManagePortal() {
    setLoading("portal");
    try {
      const result = await openCustomerPortal(tenantId);
      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        toast.error(result.error || "Failed to open billing portal");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {/* Manage Subscription (Stripe Portal) - only for Stripe subscribers */}
      {hasStripe && isActive && (
        <Button
          variant="outline"
          onClick={handleManagePortal}
          disabled={loading !== null}
        >
          {loading === "portal" ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <ExternalLink className="mr-2 size-4" />
          )}
          Manage Subscription
        </Button>
      )}

      {/* Resume (for cancelled Stripe subscriptions before period end) */}
      {hasStripe &&
        isCancelled &&
        subscription.daysRemainingInPeriod !== null &&
        subscription.daysRemainingInPeriod > 0 && (
          <Button onClick={handleResume} disabled={loading !== null}>
            {loading === "resume" && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Resume Subscription
          </Button>
        )}

      {/* Cancel Subscription */}
      {isActive && (
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
      )}
    </div>
  );
}
