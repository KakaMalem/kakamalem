"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { DateTimePicker } from "@/components/ui/date-time-picker";
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
  createInvoice,
  deleteStore,
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
  Trash2,
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
  currency: string;
  billingInterval?: string | null;
  lastReminderSentAt?: string | null;
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
  currency,
  billingInterval,
  lastReminderSentAt,
}: StoreActionsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [extendDays, setExtendDays] = useState(7);
  const [notes, setNotes] = useState(currentNotes || "");
  const [suspendReason, setSuspendReason] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  // Payment recording state
  const [paymentMonths, setPaymentMonths] = useState(1);
  const [paymentAmount, setPaymentAmount] = useState(settings.proPlanPriceAfn);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("mobile_money");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [shouldCreateInvoice, setShouldCreateInvoice] = useState(true);
  const [upgradeOnPayment, setUpgradeOnPayment] = useState(
    currentPlan === "free"
  );
  const [upgradeMonths, setUpgradeMonths] = useState<number>(1);
  const [upgradeInterval, setUpgradeInterval] = useState<"monthly" | "yearly">(
    "monthly"
  );
  const [useCustomEndDate, setUseCustomEndDate] = useState(false);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [invoiceAmount, setInvoiceAmount] = useState(settings.proPlanPriceAfn);
  const [invoiceDescription, setInvoiceDescription] = useState(
    "Kaka Malem Pro Subscription"
  );
  const [invoiceDueDate, setInvoiceDueDate] = useState<Date | null>(null);
  const [invoiceMonths, setInvoiceMonths] = useState(1);
  const [invoiceUseCustomPeriod, setInvoiceUseCustomPeriod] = useState(false);
  const [invoiceCustomStart, setInvoiceCustomStart] = useState<Date | null>(
    null
  );
  const [invoiceCustomEnd, setInvoiceCustomEnd] = useState<Date | null>(null);

  // Edit Expiry state (for already Pro stores)
  const [editExpiryDate, setEditExpiryDate] = useState<Date | null>(
    subscriptionEndsAt ? new Date(subscriptionEndsAt) : null
  );
  const [editInterval, setEditInterval] = useState<"monthly" | "yearly">(
    "monthly"
  );

  // Refund state
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundReference, setRefundReference] = useState("");

  // Pause/Resume state
  const [pauseReason, setPauseReason] = useState("");
  const [pauseAutoResumeDate, setPauseAutoResumeDate] = useState<Date | null>(
    null
  );
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
    // Auto-detect yearly if 12 months selected
    if (months === 12) {
      setUpgradeInterval("yearly");
    } else {
      setUpgradeInterval("monthly");
    }
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
    status: "trialing" | "active" | "past_due" | "cancelled" | "expired",
    options: {
      months?: number;
      billingInterval?: "monthly" | "yearly";
      customEndDate?: string;
    } = {}
  ) => {
    startTransition(async () => {
      const result = await updateStoreSubscription(storeId, plan, status, {
        months: options.months,
        billingInterval: options.billingInterval,
        customEndDate: options.customEndDate,
      });
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

  const handleCreateInvoice = () => {
    const amount = parseFloat(invoiceAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    startTransition(async () => {
      // Calculate period
      let periodStart: string | undefined;
      let periodEnd: string | undefined;

      if (invoiceUseCustomPeriod) {
        periodStart = invoiceCustomStart?.toISOString() || undefined;
        periodEnd = invoiceCustomEnd?.toISOString() || undefined;
      } else {
        const now = new Date();
        const currentEnd = subscriptionEndsAt
          ? new Date(subscriptionEndsAt)
          : null;
        const isAlreadyProWithTimeRemaining =
          currentPlan === "pro" && currentEnd && currentEnd > now;

        const start = isAlreadyProWithTimeRemaining ? currentEnd : now;
        const end = new Date(start);
        end.setMonth(end.getMonth() + invoiceMonths);

        periodStart = start.toISOString();
        periodEnd = end.toISOString();
      }

      const result = await createInvoice({
        storeId,
        amount,
        description: invoiceDescription,
        dueDate: invoiceDueDate?.toISOString() || undefined,
        periodStart,
        periodEnd,
      });

      if (result.success) {
        toast.success(result.message || "Invoice issued");
        // Reset
        setInvoiceAmount(settings.proPlanPriceAfn);
        setInvoiceDescription("Kaka Malem Pro Subscription");
        setInvoiceDueDate(null);
        setInvoiceUseCustomPeriod(false);
        setInvoiceCustomStart(null);
        setInvoiceCustomEnd(null);
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
        createInvoice: shouldCreateInvoice,
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
        autoResumeAt: pauseAutoResumeDate?.toISOString() || undefined,
      });

      if (result.success) {
        toast.success("Subscription paused successfully");
        setPauseReason("");
        setPauseAutoResumeDate(null);
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
          <div className="space-y-3 rounded-2xl border bg-muted/30 p-4 text-sm shadow-inner overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">
                Current Plan
              </span>
              <div className="flex flex-col items-end">
                <span className="font-black text-primary text-base tracking-tight capitalize">
                  {currentPlan}
                </span>
                {billingInterval && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="size-1 rounded-full bg-primary/40" />
                    <span className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter">
                      {billingInterval} BILLING
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between relative z-10">
              <span className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">
                Status
              </span>
              <Badge
                variant={
                  currentSubscriptionStatus === "active"
                    ? "default"
                    : currentSubscriptionStatus === "trialing"
                      ? "secondary"
                      : "destructive"
                }
                className={`h-6 px-3 text-[10px] font-black uppercase tracking-tighter shadow-sm border-none ${
                  currentSubscriptionStatus === "active"
                    ? "bg-primary text-primary-foreground"
                    : currentSubscriptionStatus === "trialing"
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-destructive text-destructive-foreground"
                }`}
              >
                {currentSubscriptionStatus}
              </Badge>
            </div>
            <div className="flex items-center justify-between border-t border-border/50 pt-3 mt-1 relative z-10">
              <span className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">
                {currentPlan === "pro"
                  ? "Expiration Date"
                  : "Trial Period Ends"}
              </span>
              <span
                className={`font-black tracking-tight text-sm ${
                  subscriptionEndsAt &&
                  new Date(subscriptionEndsAt) < new Date()
                    ? "text-destructive"
                    : "text-foreground"
                }`}
              >
                {subscriptionEndsAt
                  ? new Date(subscriptionEndsAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}
              </span>
            </div>

            {lastReminderSentAt && (
              <div className="mt-2 flex justify-between text-[9px] text-muted-foreground/60 font-medium italic border-t border-border/30 pt-2">
                <span>Last auto-reminder:</span>
                <span>{new Date(lastReminderSentAt).toLocaleString()}</span>
              </div>
            )}
          </div>

          {currentPlan === "free" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="default"
                  className="w-full h-11 font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-[0.98]"
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="mr-2 size-5 animate-spin" />
                  ) : (
                    <Crown className="mr-2 size-5 fill-current" />
                  )}
                  Upgrade Store to Pro
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-none shadow-2xl">
                <div className="bg-primary/5 px-6 py-5 border-b border-primary/10">
                  <AlertDialogHeader>
                    <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                      <Crown className="size-6 text-primary fill-primary/20" />
                    </div>
                    <AlertDialogTitle className="text-xl font-black tracking-tight text-primary">
                      Upgrade to Pro Plan
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground/80 font-medium">
                      Store will gain access to all premium features. Please
                      confirm that payment has been received ($
                      {settings.proPlanPriceAfn} AFN/mo).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                </div>

                <div className="p-6 space-y-7">
                  <div className="grid gap-5">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        Billing Cycle
                      </Label>
                      <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl border border-border/50">
                        <Button
                          type="button"
                          variant={
                            upgradeInterval === "monthly" ? "default" : "ghost"
                          }
                          size="sm"
                          onClick={() => {
                            setUpgradeInterval("monthly");
                            if (upgradeMonths >= 12) setUpgradeMonths(1);
                          }}
                          className={`w-full h-10 font-bold rounded-lg ${
                            upgradeInterval === "monthly"
                              ? "shadow-sm"
                              : "text-muted-foreground"
                          }`}
                        >
                          Monthly
                        </Button>
                        <Button
                          type="button"
                          variant={
                            upgradeInterval === "yearly" ? "default" : "ghost"
                          }
                          size="sm"
                          onClick={() => {
                            setUpgradeInterval("yearly");
                            setUpgradeMonths(12);
                          }}
                          className={`w-full h-10 font-bold rounded-lg ${
                            upgradeInterval === "yearly"
                              ? "shadow-sm"
                              : "text-muted-foreground"
                          }`}
                        >
                          Yearly (Save)
                        </Button>
                      </div>
                    </div>

                    {!useCustomEndDate && (
                      <div className="space-y-3">
                        <Label
                          htmlFor="upgrade-duration"
                          className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1"
                        >
                          Plan Duration
                        </Label>
                        <div className="flex flex-wrap items-center gap-2">
                          {[1, 3, 6, 12, 24].map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => {
                                setUpgradeMonths(m);
                                if (m >= 12) setUpgradeInterval("yearly");
                                else if (upgradeInterval === "yearly")
                                  setUpgradeInterval("monthly");
                              }}
                              className={`rounded-xl px-4 py-2 text-xs font-black transition-all border ${
                                upgradeMonths === m
                                  ? "bg-primary text-primary-foreground border-primary shadow-md scale-105"
                                  : "bg-background text-muted-foreground border-border hover:bg-muted"
                              }`}
                            >
                              {m} MONTHS
                            </button>
                          ))}
                          <div className="relative ml-auto">
                            <Input
                              id="upgrade-duration"
                              type="number"
                              className="w-[70px] h-9 text-xs font-black border-dashed focus:border-solid text-center pr-0"
                              value={upgradeMonths}
                              onChange={(e) =>
                                setUpgradeMonths(parseInt(e.target.value) || 1)
                              }
                              onWheel={(e) => e.currentTarget.blur()}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between px-1">
                        <div className="space-y-0.5">
                          <Label
                            htmlFor="use-custom-date"
                            className="text-xs cursor-pointer font-bold"
                          >
                            Manual End Date
                          </Label>
                          <p className="text-[10px] text-muted-foreground">
                            Override calculated expiration date
                          </p>
                        </div>
                        <Switch
                          id="use-custom-date"
                          checked={useCustomEndDate}
                          onCheckedChange={setUseCustomEndDate}
                        />
                      </div>

                      {useCustomEndDate ? (
                        <div className="p-1 bg-muted rounded-xl border border-border/50 animate-in fade-in slide-in-from-top-2">
                          <DateTimePicker
                            value={customEndDate}
                            onChange={setCustomEndDate}
                            placeholder="Select exact date & time"
                            className="h-10 border-none bg-transparent"
                          />
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-primary/5 p-4 border-2 border-primary/10 flex items-center justify-between">
                          <div className="space-y-0.5">
                            <p className="text-[10px] uppercase text-primary font-black tracking-widest opacity-80">
                              Access Until
                            </p>
                            <p className="text-sm font-black text-primary">
                              {new Date(
                                new Date().setMonth(
                                  new Date().getMonth() + upgradeMonths
                                )
                              ).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </p>
                          </div>
                          <Clock className="size-5 text-primary opacity-20" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-muted/30 border-t border-border flex items-center gap-3">
                  <AlertDialogCancel className="flex-1 h-12 font-bold rounded-xl border-none hover:bg-muted">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="flex-2 h-12 font-black rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                    onClick={() =>
                      handleSubscriptionChange("pro", "active", {
                        months: upgradeMonths,
                        billingInterval: upgradeInterval,
                        customEndDate: useCustomEndDate
                          ? customEndDate?.toISOString()
                          : undefined,
                      })
                    }
                  >
                    Confirm & Upgrade
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <div className="grid gap-4 pt-4 border-t border-border/50">
            {currentPlan === "pro" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 h-10 font-bold transition-colors"
                    disabled={isPending}
                  >
                    <AlertTriangle className="mr-2 size-4" />
                    Downgrade Store to Free
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-destructive">
                      Downgrade to Free?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will immediately downgrade the store to the Free
                      plan. The store will lose access to Pro features.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleSubscriptionChange("free", "active")}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
                    >
                      Confirm Downgrade
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {currentSubscriptionStatus === "trialing" && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border/50" />
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Extend Trial
                  </Label>
                  <div className="flex-1 h-px bg-border/50" />
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={extendDays}
                      onChange={(e) =>
                        setExtendDays(parseInt(e.target.value) || 7)
                      }
                      onWheel={(e) => e.currentTarget.blur()}
                      className="h-10 pr-12 font-bold focus-visible:ring-primary/20"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[9px] font-black text-muted-foreground">
                      DAYS
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleExtendTrial}
                    disabled={isPending}
                    className="px-6 h-10 font-bold"
                  >
                    {isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Clock className="mr-2 size-4 text-primary" />
                    )}
                    Extend
                  </Button>
                </div>
              </div>
            )}

            {currentSubscriptionStatus === "expired" && (
              <Button
                variant="outline"
                className="w-full h-11 font-bold border-dashed border-2 hover:border-solid transition-all"
                onClick={() => handleSubscriptionChange("free", "trialing")}
                disabled={isPending}
              >
                <Clock className="mr-2 size-4 text-orange-500" />
                Restart Trial Period
              </Button>
            )}
          </div>

          {currentPlan === "pro" && (
            <div className="mt-6 pt-5 border-y border-border -mx-6 px-6 bg-muted/40 rounded-b-xl">
              <div className="flex items-center justify-between mb-4">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
                  Quick Actions
                </Label>
                <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2 py-0.5 rounded-full ring-1 ring-primary/20">
                  <div className="size-1 rounded-full bg-primary animate-pulse" />
                  <span className="text-[9px] font-black tracking-tighter">
                    ADVANCED
                  </span>
                </div>
              </div>

              <div className="space-y-6 pb-6 pt-1">
                <div className="space-y-2.5">
                  <Label className="text-[11px] text-muted-foreground/80 font-bold uppercase ml-1">
                    Expiration Date
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="sm:col-span-3">
                      <DateTimePicker
                        value={editExpiryDate}
                        onChange={setEditExpiryDate}
                        className="h-10 w-full font-medium"
                      />
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-10 w-full font-bold shadow-sm"
                      disabled={isPending || !editExpiryDate}
                      onClick={() =>
                        handleSubscriptionChange("pro", "active", {
                          customEndDate:
                            editExpiryDate?.toISOString() || undefined,
                          billingInterval: editInterval,
                        })
                      }
                    >
                      Update
                    </Button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Label className="text-[11px] text-muted-foreground/80 font-bold uppercase ml-1">
                    Billing Interval
                  </Label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-background rounded-xl border border-border shadow-inner">
                    <button
                      type="button"
                      onClick={() => setEditInterval("monthly")}
                      className={`h-9 flex items-center justify-center rounded-lg text-[10px] font-black tracking-wide transition-all ${
                        editInterval === "monthly"
                          ? "bg-primary text-primary-foreground shadow-md scale-[1.02] ring-1 ring-primary/50"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      MONTHLY BILLING
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditInterval("yearly")}
                      className={`h-9 flex items-center justify-center rounded-lg text-[10px] font-black tracking-wide transition-all ${
                        editInterval === "yearly"
                          ? "bg-primary text-primary-foreground shadow-md scale-[1.02] ring-1 ring-primary/50"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      YEARLY BILLING
                    </button>
                  </div>
                </div>
              </div>
            </div>
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
                    <DateTimePicker
                      value={pauseAutoResumeDate}
                      onChange={setPauseAutoResumeDate}
                      minDate={new Date(Date.now() + 86400000)}
                      maxDate={new Date(Date.now() + 90 * 86400000)}
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

      {/* Issue Unpaid Invoice */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-600">
            <FileText className="size-5" />
            Issue Unpaid Invoice
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Create an invoice for a user who hasn&apos;t paid yet. They will be
            able to see and download this invoice from their dashboard.
          </p>
          <div className="space-y-2">
            <Label htmlFor="inv-desc">Description</Label>
            <Input
              id="inv-desc"
              value={invoiceDescription}
              onChange={(e) => setInvoiceDescription(e.target.value)}
              placeholder="e.g. Pro Plan Subscription (Annual)"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="inv-amount">Amount ({currency})</Label>
              <Input
                id="inv-amount"
                type="number"
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-due">Due Date (optional)</Label>
              <DateTimePicker
                value={invoiceDueDate}
                onChange={setInvoiceDueDate}
                placeholder="Pick a due date"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Set Subscription Period</Label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  Custom Range
                </span>
                <Switch
                  checked={invoiceUseCustomPeriod}
                  onCheckedChange={setInvoiceUseCustomPeriod}
                />
              </div>
            </div>

            {invoiceUseCustomPeriod ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Start Date
                  </Label>
                  <DateTimePicker
                    value={invoiceCustomStart}
                    onChange={setInvoiceCustomStart}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    End Date
                  </Label>
                  <DateTimePicker
                    value={invoiceCustomEnd}
                    onChange={setInvoiceCustomEnd}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {[1, 3, 6, 12, 24].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setInvoiceMonths(m)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors border ${
                        invoiceMonths === m
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted hover:bg-muted/80 border-border"
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Label className="text-[10px] text-muted-foreground">
                      Custom:
                    </Label>
                    <Input
                      type="number"
                      className="w-16 h-8 text-xs"
                      min={1}
                      value={invoiceMonths}
                      onChange={(e) =>
                        setInvoiceMonths(parseInt(e.target.value) || 1)
                      }
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  Period starts from current end date (if Pro) or today.
                </p>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            className="w-full border-amber-200 hover:bg-amber-50"
            onClick={handleCreateInvoice}
            disabled={isPending || !invoiceAmount}
          >
            {isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <FileText className="mr-2 size-4" />
            )}
            Issue Unpaid Invoice
          </Button>
        </CardContent>
      </Card>

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
            <div className="flex flex-wrap items-center gap-1.5">
              {[1, 3, 6, 12, 24].map((months) => (
                <button
                  key={months}
                  type="button"
                  onClick={() => handleMonthsChange(months)}
                  className={`h-9 px-3 rounded-md border text-xs font-bold transition-all ${
                    paymentMonths === months
                      ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                      : "bg-muted hover:bg-muted/80 border-border text-muted-foreground"
                  }`}
                >
                  {months}m
                </button>
              ))}

              <div
                className={`flex items-center gap-1.5 px-2.5 h-9 rounded-md border transition-all ${
                  ![1, 3, 6, 12, 24].includes(paymentMonths)
                    ? "bg-primary/5 border-primary ring-1 ring-primary/20 shadow-sm"
                    : "bg-muted/30 border-dashed border-border"
                }`}
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                  Custom
                </span>
                <input
                  type="number"
                  className="w-10 bg-transparent border-none text-xs font-black text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  min={1}
                  value={paymentMonths}
                  onChange={(e) =>
                    handleMonthsChange(parseInt(e.target.value) || 1)
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                />
                <span className="text-[10px] font-bold text-muted-foreground/50">
                  MOS
                </span>
              </div>
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
                checked={shouldCreateInvoice}
                onCheckedChange={(checked) =>
                  setShouldCreateInvoice(checked === true)
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

      {/* Danger Zone — Delete Store */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="size-4" />
            Delete Store
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Permanently delete this store and all its data (products, orders,
            media). This action cannot be undone.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={isPending}>
                <Trash2 className="mr-2 size-4" />
                Delete Store
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete &quot;{storeName}&quot;?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the store and all associated data
                  including products, orders, media, and customer records. This
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 py-2">
                <Label className="text-sm">
                  Type <span className="font-semibold">{storeName}</span> to
                  confirm
                </Label>
                <Input
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder={storeName}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteConfirmation("")}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleteConfirmation !== storeName || isPending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await deleteStore(
                        storeId,
                        deleteConfirmation
                      );
                      if (result.success) {
                        toast.success(result.message);
                        router.push("/admin/stores");
                      } else {
                        toast.error(result.error);
                      }
                      setDeleteConfirmation("");
                    });
                  }}
                >
                  {isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 size-4" />
                  )}
                  Delete Permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
