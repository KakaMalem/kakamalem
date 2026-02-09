"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  updateStoreStatus,
  updateStoreSubscription,
  extendStoreTrial,
  addStoreNotes,
  recordBillingTransaction,
} from "@/lib/actions/admin";
import {
  pauseSubscription,
  resumeSubscription,
  getRefundPreview,
  requestSubscriptionRefund,
  type ProratedRefundCalculation,
} from "@/lib/actions/subscriptions";
import {
  Ban,
  CheckCircle,
  Clock,
  Crown,
  FileText,
  Loader2,
  AlertTriangle,
  CreditCard,
  Receipt,
  Undo2,
  Pause,
  Play,
  Calculator,
  Calendar,
} from "lucide-react";
import type { PaymentMethod } from "@/lib/db/schema";

// =============================================================================
// STORE ACTIONS CLIENT COMPONENT
// =============================================================================
// Client component for store management actions
// =============================================================================

interface StoreActionsClientProps {
  storeId: string;
  storeSlug: string;
  storeName: string;
  currentStatus: string;
  currentPlan: string;
  currentSubscriptionStatus: string;
  subscriptionEndsAt: string | null;
  pausedAt: string | null;
  autoResumeAt: string | null;
  currentNotes: string | null;
  settings: {
    proPlanPriceAfn: string;
    trialDurationDays: number;
  };
}

export function StoreActionsClient({
  storeId,
  storeSlug: _storeSlug,
  storeName,
  currentStatus,
  currentPlan,
  currentSubscriptionStatus,
  subscriptionEndsAt,
  pausedAt,
  autoResumeAt,
  currentNotes,
  settings,
}: StoreActionsClientProps) {
  const [isPending, startTransition] = useTransition();
  const [extendDays, setExtendDays] = useState(7);
  const [notes, setNotes] = useState(currentNotes || "");
  const [suspendReason, setSuspendReason] = useState("");

  // Payment recording state
  const [paymentMonths, setPaymentMonths] = useState(1);
  const [paymentAmount, setPaymentAmount] = useState(settings.proPlanPriceAfn);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("mobile_money");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [createInvoice, setCreateInvoice] = useState(true);
  const [upgradeOnPayment, setUpgradeOnPayment] = useState(
    currentPlan === "free"
  );

  // Refund state
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundReference, setRefundReference] = useState("");

  // Pause/Resume state
  const [pauseReason, setPauseReason] = useState("");
  const [pauseAutoResumeDate, setPauseAutoResumeDate] = useState("");
  const isPaused = !!pausedAt;

  // Prorated refund state
  const [refundPreview, setRefundPreview] =
    useState<ProratedRefundCalculation | null>(null);
  const [refundPreviewLoading, setRefundPreviewLoading] = useState(false);
  const [proratedRefundReason, setProratedRefundReason] = useState("");

  // Update payment amount when months change
  const handleMonthsChange = (months: number) => {
    setPaymentMonths(months);
    const basePrice = parseFloat(settings.proPlanPriceAfn);
    setPaymentAmount((basePrice * months).toString());
  };

  // Calculate what the new subscription end date will be
  const calculateNewEndDate = () => {
    const currentEnd = subscriptionEndsAt ? new Date(subscriptionEndsAt) : null;
    const now = new Date();

    // If already Pro with time remaining, extend from current end
    const isAlreadyProWithTimeRemaining =
      currentPlan === "pro" && currentEnd && currentEnd > now;

    const extendFrom = isAlreadyProWithTimeRemaining ? currentEnd : now;
    const newEnd = new Date(extendFrom);
    newEnd.setDate(newEnd.getDate() + paymentMonths * 30);
    return newEnd;
  };

  // Check subscription status for display
  const hasActiveSubscription =
    currentPlan === "pro" &&
    subscriptionEndsAt &&
    new Date(subscriptionEndsAt) > new Date();

  const daysRemaining = hasActiveSubscription
    ? Math.ceil(
        (new Date(subscriptionEndsAt!).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 0;

  const handleStatusChange = (
    status: "pending_review" | "active" | "suspended" | "inactive",
    reason?: string
  ) => {
    startTransition(async () => {
      const result = await updateStoreStatus(storeId, status, reason);
      if (result.success) {
        toast.success(result.message || "Status updated");
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleSubscriptionChange = (
    plan: "free" | "pro",
    status: "trialing" | "active" | "past_due" | "cancelled" | "expired"
  ) => {
    startTransition(async () => {
      const result = await updateStoreSubscription(storeId, plan, status);
      if (result.success) {
        toast.success(result.message || "Subscription updated");
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleExtendTrial = () => {
    startTransition(async () => {
      const result = await extendStoreTrial(storeId, extendDays);
      if (result.success) {
        toast.success(result.message || "Trial extended");
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleSaveNotes = () => {
    startTransition(async () => {
      const result = await addStoreNotes(storeId, notes);
      if (result.success) {
        toast.success("Notes saved");
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleRecordPayment = () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    // Calculate period with subscription stacking
    // Industry standard: extend from MAX(now, current subscription end)
    const now = new Date();
    const currentEnd = subscriptionEndsAt ? new Date(subscriptionEndsAt) : null;
    const isAlreadyProWithTimeRemaining =
      currentPlan === "pro" && currentEnd && currentEnd > now;

    // Period starts from where the subscription currently ends (if extending)
    // or from now (if starting fresh)
    const periodStart = isAlreadyProWithTimeRemaining ? currentEnd : now;
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + paymentMonths * 30);

    startTransition(async () => {
      const result = await recordBillingTransaction({
        storeId,
        type: "subscription_payment",
        amount,
        paymentMethod,
        paymentReference: paymentReference || undefined,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        notes: paymentNotes || undefined,
        createInvoice,
        upgradeToProOnPayment: upgradeOnPayment,
        periodMonths: paymentMonths,
      });

      if (result.success) {
        toast.success(result.message || "Payment recorded");
        // Reset form
        setPaymentReference("");
        setPaymentNotes("");
        setPaymentMonths(1);
        setPaymentAmount(settings.proPlanPriceAfn);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleRecordRefund = () => {
    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid refund amount");
      return;
    }

    startTransition(async () => {
      const result = await recordBillingTransaction({
        storeId,
        type: "refund",
        amount: -amount, // Negative amount for refund
        paymentReference: refundReference || undefined,
        notes: refundReason || undefined,
        createInvoice: false,
        upgradeToProOnPayment: false,
      });

      if (result.success) {
        toast.success("Refund recorded successfully");
        // Reset form
        setRefundAmount("");
        setRefundReason("");
        setRefundReference("");
      } else {
        toast.error(result.error);
      }
    });
  };

  // Pause subscription
  const handlePauseSubscription = () => {
    startTransition(async () => {
      const result = await pauseSubscription(storeId, {
        reason: pauseReason || undefined,
        autoResumeAt: pauseAutoResumeDate || undefined,
      });

      if (result.success) {
        toast.success("Subscription paused successfully");
        setPauseReason("");
        setPauseAutoResumeDate("");
      } else {
        toast.error(result.error);
      }
    });
  };

  // Resume subscription
  const handleResumeSubscription = () => {
    startTransition(async () => {
      const result = await resumeSubscription(storeId);

      if (result.success) {
        toast.success(
          `Subscription resumed! ${result.creditsDays} days credited.`
        );
      } else {
        toast.error(result.error);
      }
    });
  };

  // Load prorated refund preview
  const handleLoadRefundPreview = async () => {
    setRefundPreviewLoading(true);
    try {
      const result = await getRefundPreview(storeId);
      if (result.success && result.calculation) {
        setRefundPreview(result.calculation);
      } else {
        toast.error(result.error || "Failed to calculate refund");
      }
    } catch {
      toast.error("Failed to load refund preview");
    } finally {
      setRefundPreviewLoading(false);
    }
  };

  // Process prorated refund
  const handleProratedRefund = () => {
    startTransition(async () => {
      const result = await requestSubscriptionRefund(storeId, {
        reason: proratedRefundReason || "Admin-initiated refund",
        reasonCode: "admin",
        refundMethod: "original_payment",
        adminNotes: `Prorated refund processed by admin`,
      });

      if (result.success) {
        toast.success(
          `Refund of ${result.calculation?.refundAmount.toFixed(2)} AFN requested`
        );
        setRefundPreview(null);
        setProratedRefundReason("");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentStatus !== "active" && (
            <Button
              variant="default"
              className="w-full justify-start"
              onClick={() => handleStatusChange("active")}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 size-4" />
              )}
              Activate Store
            </Button>
          )}

          {currentStatus === "active" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  disabled={isPending}
                >
                  <Ban className="mr-2 size-4" />
                  Suspend Store
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Suspend {storeName}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will immediately disable the store. Customers will not
                    be able to access it.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                  <Label htmlFor="suspend-reason">Reason (optional)</Label>
                  <Textarea
                    id="suspend-reason"
                    placeholder="Enter reason for suspension..."
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      handleStatusChange("suspended", suspendReason)
                    }
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Suspend
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardContent>
      </Card>

      {/* Subscription Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="size-5" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentPlan === "free" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="default"
                  className="w-full justify-start"
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Crown className="mr-2 size-4" />
                  )}
                  Upgrade to Pro ({settings.proPlanPriceAfn} AFN/mo)
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Upgrade to Pro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will upgrade the store to Pro plan with all features
                    enabled. Make sure payment has been received.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleSubscriptionChange("pro", "active")}
                  >
                    Confirm Upgrade
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {currentPlan === "pro" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={isPending}
                >
                  <AlertTriangle className="mr-2 size-4" />
                  Downgrade to Free
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Downgrade to Free?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will downgrade the store to the free plan. They will
                    lose access to Pro features and be limited to{" "}
                    {settings.trialDurationDays} products.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleSubscriptionChange("free", "active")}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Downgrade
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {currentSubscriptionStatus === "trialing" && (
            <div className="space-y-2">
              <Label>Extend Trial</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={extendDays}
                  onChange={(e) => setExtendDays(parseInt(e.target.value) || 7)}
                  onWheel={(e) => e.currentTarget.blur()}
                  className="w-20"
                />
                <span className="flex items-center text-sm text-muted-foreground">
                  days
                </span>
                <Button
                  variant="outline"
                  onClick={handleExtendTrial}
                  disabled={isPending}
                  className="flex-1"
                >
                  {isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Clock className="mr-2 size-4" />
                  )}
                  Extend
                </Button>
              </div>
            </div>
          )}

          {currentSubscriptionStatus === "expired" && (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleSubscriptionChange("free", "trialing")}
              disabled={isPending}
            >
              <Clock className="mr-2 size-4" />
              Restart Trial
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Pause/Resume Subscription - Only for active Pro subscriptions */}
      {currentPlan === "pro" && currentSubscriptionStatus === "active" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isPaused ? (
                <Play className="size-5 text-green-600" />
              ) : (
                <Pause className="size-5 text-amber-600" />
              )}
              {isPaused ? "Resume Subscription" : "Pause Subscription"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isPaused ? (
              <>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-medium">
                    Subscription is currently paused
                  </p>
                  <p className="text-xs mt-1 opacity-80">
                    Paused on {new Date(pausedAt!).toLocaleDateString()}
                  </p>
                  {autoResumeAt && (
                    <p className="text-xs mt-0.5 opacity-80">
                      Auto-resume scheduled for{" "}
                      {new Date(autoResumeAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Button
                  className="w-full"
                  onClick={handleResumeSubscription}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 size-4" />
                  )}
                  Resume Now (Credit Pause Days)
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="pause-reason">
                    Reason for Pausing (optional)
                  </Label>
                  <Textarea
                    id="pause-reason"
                    value={pauseReason}
                    onChange={(e) => setPauseReason(e.target.value)}
                    placeholder="Customer requested temporary pause..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auto-resume">
                    Auto-Resume Date (optional)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <Input
                      id="auto-resume"
                      type="date"
                      value={pauseAutoResumeDate}
                      onChange={(e) => setPauseAutoResumeDate(e.target.value)}
                      min={
                        new Date(Date.now() + 86400000)
                          .toISOString()
                          .split("T")[0]
                      }
                      max={
                        new Date(Date.now() + 90 * 86400000)
                          .toISOString()
                          .split("T")[0]
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Max pause duration: 90 days. Days paused extend the
                    subscription on resume.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handlePauseSubscription}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Pause className="mr-2 size-4" />
                  )}
                  Pause Subscription
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Prorated Refund - Only for active Pro subscriptions */}
      {currentPlan === "pro" &&
        currentSubscriptionStatus === "active" &&
        !isPaused && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="size-5" />
                Prorated Refund
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!refundPreview ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleLoadRefundPreview}
                  disabled={refundPreviewLoading}
                >
                  {refundPreviewLoading ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Calculator className="mr-2 size-4" />
                  )}
                  Calculate Prorated Refund
                </Button>
              ) : (
                <>
                  <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Original Payment
                      </span>
                      <span className="font-medium">
                        {refundPreview.originalAmount.toFixed(2)} AFN
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Days Used</span>
                      <span>{refundPreview.daysUsed} days</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Days Remaining
                      </span>
                      <span>{refundPreview.daysRemaining} days</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Daily Rate</span>
                      <span>{refundPreview.dailyRate.toFixed(2)} AFN/day</span>
                    </div>
                    <div className="border-t pt-2 mt-2 flex justify-between font-medium">
                      <span>Refund Amount</span>
                      <span className="text-green-600">
                        {refundPreview.refundAmount.toFixed(2)} AFN
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prorated-reason">
                      Reason for Refund (optional)
                    </Label>
                    <Textarea
                      id="prorated-reason"
                      value={proratedRefundReason}
                      onChange={(e) => setProratedRefundReason(e.target.value)}
                      placeholder="Customer requested cancellation..."
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setRefundPreview(null)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          disabled={isPending}
                          className="flex-1"
                        >
                          {isPending ? (
                            <Loader2 className="mr-2 size-4 animate-spin" />
                          ) : (
                            <Undo2 className="mr-2 size-4" />
                          )}
                          Process Refund
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Process Prorated Refund?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This will refund{" "}
                            <strong>
                              {refundPreview.refundAmount.toFixed(2)} AFN
                            </strong>{" "}
                            and immediately downgrade the store to the Free
                            plan. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleProratedRefund}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Confirm Refund
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

      {/* Record Payment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-5" />
            Record Payment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Subscription Status Banner - Industry standard: show what will happen */}
          {upgradeOnPayment && (
            <div
              className={`rounded-lg p-3 text-sm ${
                hasActiveSubscription
                  ? "bg-blue-50 border border-blue-200 text-blue-900"
                  : "bg-amber-50 border border-amber-200 text-amber-900"
              }`}
            >
              {hasActiveSubscription ? (
                <>
                  <p className="font-medium">Extending existing subscription</p>
                  <p className="text-xs mt-1 opacity-80">
                    Currently Pro until{" "}
                    {new Date(subscriptionEndsAt!).toLocaleDateString()} (
                    {daysRemaining} days remaining)
                  </p>
                  <p className="text-xs mt-0.5 opacity-80">
                    → New end date:{" "}
                    <strong>
                      {calculateNewEndDate().toLocaleDateString()}
                    </strong>
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">Starting new Pro subscription</p>
                  <p className="text-xs mt-1 opacity-80">
                    Will be Pro until{" "}
                    <strong>
                      {calculateNewEndDate().toLocaleDateString()}
                    </strong>
                  </p>
                </>
              )}
            </div>
          )}

          {/* Period / Duration Selection */}
          <div className="space-y-2">
            <Label>Subscription Period</Label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 3, 6, 12].map((months) => (
                <button
                  key={months}
                  type="button"
                  onClick={() => handleMonthsChange(months)}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    paymentMonths === months
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted hover:bg-muted/80 border-border"
                  }`}
                >
                  {months} {months === 1 ? "month" : "months"}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {paymentMonths} month{paymentMonths !== 1 && "s"} ={" "}
              {paymentMonths * 30} days of Pro access
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Amount (AFN)</Label>
              <Input
                id="payment-amount"
                type="number"
                min={0}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="1100"
              />
              {paymentMonths > 1 && (
                <p className="text-xs text-muted-foreground">
                  Base: {settings.proPlanPriceAfn} × {paymentMonths} months
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-method">Payment Method</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              >
                <SelectTrigger id="payment-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile_money">HesabPay</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="card">Card (Stripe)</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="credit">USDT (Crypto)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-reference">Payment Reference</Label>
            <Input
              id="payment-reference"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="Transaction ID, receipt number, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-notes">Notes (optional)</Label>
            <Textarea
              id="payment-notes"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="Additional notes about this payment..."
              rows={2}
            />
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="create-invoice"
                checked={createInvoice}
                onCheckedChange={(checked) =>
                  setCreateInvoice(checked === true)
                }
              />
              <Label
                htmlFor="create-invoice"
                className="cursor-pointer text-sm"
              >
                Generate invoice for this payment
              </Label>
            </div>
            {currentPlan === "free" && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="upgrade-on-payment"
                  checked={upgradeOnPayment}
                  onCheckedChange={(checked) =>
                    setUpgradeOnPayment(checked === true)
                  }
                />
                <Label
                  htmlFor="upgrade-on-payment"
                  className="cursor-pointer text-sm"
                >
                  Upgrade to Pro after payment
                </Label>
              </div>
            )}
          </div>

          <Button
            className="w-full"
            onClick={handleRecordPayment}
            disabled={isPending || !paymentAmount}
          >
            {isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Receipt className="mr-2 size-4" />
            )}
            Record Payment
          </Button>
        </CardContent>
      </Card>

      {/* Record Refund */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Undo2 className="size-5" />
            Record Refund
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="refund-amount">Refund Amount (AFN)</Label>
              <Input
                id="refund-amount"
                type="number"
                min={0}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refund-reference">Reference (optional)</Label>
              <Input
                id="refund-reference"
                value={refundReference}
                onChange={(e) => setRefundReference(e.target.value)}
                placeholder="Original transaction ID"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund-reason">Reason for Refund (optional)</Label>
            <Textarea
              id="refund-reason"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Why is this refund being issued?"
              rows={2}
            />
          </div>

          <Button
            variant="destructive"
            className="w-full"
            onClick={handleRecordRefund}
            disabled={isPending || !refundAmount}
          >
            {isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Undo2 className="mr-2 size-4" />
            )}
            Record Refund
          </Button>
        </CardContent>
      </Card>

      {/* Admin Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Admin Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Add internal notes about this store..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
          <Button
            variant="outline"
            onClick={handleSaveNotes}
            disabled={isPending || notes === (currentNotes || "")}
            className="w-full"
          >
            {isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <FileText className="mr-2 size-4" />
            )}
            Save Notes
          </Button>
        </CardContent>
      </Card>

      {/* Status Change */}
      <Card>
        <CardHeader>
          <CardTitle>Change Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={currentStatus}
            onValueChange={(value) =>
              handleStatusChange(
                value as "pending_review" | "active" | "suspended" | "inactive"
              )
            }
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    </div>
  );
}
