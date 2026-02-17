"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { BillingStatusCard } from "./billing-status-card";
import { SubscriptionActions } from "./subscription-actions";
import { PlanComparison } from "./plan-comparison";
import { InvoiceList } from "./invoice-list";
import { InvoiceDetailDialog } from "./invoice-detail-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { verifyPendingSubscriptionPayment } from "@/lib/actions/payments";
import type {
  SubscriptionOverview,
  InvoiceWithStats,
} from "@/lib/db/queries/billing";

interface BillingPageClientProps {
  tenantId: string;
  storeSlug: string;
  storeName: string;
  currency: string;
  subscription: SubscriptionOverview;
  invoices: InvoiceWithStats[];
  invoicesTotal: number;
}

// HesabPay redirect data structure
interface HesabPayRedirectData {
  success: boolean;
  message?: string;
  transaction_id?: string | null;
}

// Parse HesabPay redirect data from URL
function parseHesabPayData(
  dataParam: string | null
): HesabPayRedirectData | null {
  if (!dataParam) return null;

  try {
    // HesabPay might URL-encode the JSON or pass it directly
    const decoded = decodeURIComponent(dataParam);
    return JSON.parse(decoded) as HesabPayRedirectData;
  } catch {
    // Try parsing directly without decoding
    try {
      return JSON.parse(dataParam) as HesabPayRedirectData;
    } catch {
      console.error("[Billing] Failed to parse HesabPay data:", dataParam);
      return null;
    }
  }
}

export function BillingPageClient({
  tenantId,
  storeSlug,
  currency,
  subscription,
  invoices,
  invoicesTotal,
}: BillingPageClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Parse payment result from URL parameters
  // HesabPay appends ?data={success, message, transaction_id}
  // Stripe uses ?upgrade=success/cancelled
  // We also check for our own ?payment=success/cancelled param as fallback
  const paymentResult = useMemo(() => {
    const dataParam = searchParams.get("data");
    const paymentParam = searchParams.get("payment");
    const upgradeParam = searchParams.get("upgrade");

    // First try to parse HesabPay's data parameter
    const hesabPayData = parseHesabPayData(dataParam);
    if (hesabPayData) {
      return {
        status: hesabPayData.success
          ? ("success" as const)
          : ("failed" as const),
        message: hesabPayData.message,
        transactionId: hesabPayData.transaction_id,
      };
    }

    // Check for Stripe upgrade parameter
    if (upgradeParam === "success") {
      return {
        status: "success" as const,
        message:
          "Your subscription has been upgraded to Pro via Stripe. Welcome aboard!",
        transactionId: undefined,
      };
    }
    if (upgradeParam === "cancelled") {
      return {
        status: "cancelled" as const,
        message: "Your upgrade was cancelled. You can try again anytime.",
        transactionId: undefined,
      };
    }

    // Fallback to our own payment parameter
    if (paymentParam === "success") {
      return {
        status: "success" as const,
        message: undefined,
        transactionId: undefined,
      };
    }
    if (paymentParam === "cancelled") {
      return {
        status: "cancelled" as const,
        message: undefined,
        transactionId: undefined,
      };
    }

    return null;
  }, [searchParams]);

  const [showAlert, setShowAlert] = useState(!!paymentResult);
  const [isVerifying, setIsVerifying] = useState(false);

  // Verify payment with HesabPay API on successful redirect
  const verified = useRef(false);

  useEffect(() => {
    if (paymentResult?.status !== "success" || verified.current) return;

    // Already active — no need to verify
    if (subscription.status === "active" && subscription.plan === "pro") return;

    verified.current = true;
    setIsVerifying(true);

    const verify = async () => {
      try {
        const result = await verifyPendingSubscriptionPayment(tenantId);
        if (result.activated) {
          // Refresh server component data to show updated subscription
          router.refresh();
        }
      } catch (err) {
        console.error("[Billing] Payment verification failed:", err);
      } finally {
        setIsVerifying(false);
      }
    };

    // Small delay to let gateway finish processing
    const timer = setTimeout(verify, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentResult?.status]);

  // Invoice viewing state
  const [selectedInvoice, setSelectedInvoice] =
    useState<InvoiceWithStats | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);

  // Handler for viewing invoice
  const handleViewInvoice = useCallback(
    (invoiceId: string) => {
      const invoice = invoices.find((inv) => inv.id === invoiceId);
      if (invoice) {
        setSelectedInvoice(invoice);
        setInvoiceDialogOpen(true);
      }
    },
    [invoices]
  );

  // Handler for downloading invoice PDF
  const handleDownloadInvoice = useCallback(
    async (invoiceId: string) => {
      try {
        const res = await fetch(
          `/api/dashboard/${storeSlug}/billing/invoices/${invoiceId}/download`
        );
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          alert(err?.error || "Failed to download invoice");
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const invoice = invoices.find((inv) => inv.id === invoiceId);
        a.href = url;
        a.download = `invoice-${invoice?.invoiceNumber || invoiceId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch {
        alert("Failed to download invoice. Please try again.");
      }
    },
    [storeSlug, invoices]
  );

  // Track if we've already cleared the URL
  const clearedUrl = useRef(false);

  // Clear the URL params after mounting (only once)
  useEffect(() => {
    const hasParams =
      searchParams.get("data") ||
      searchParams.get("payment") ||
      searchParams.get("upgrade");
    if (hasParams && !clearedUrl.current) {
      clearedUrl.current = true;
      // Use setTimeout to avoid blocking the render
      const timer = setTimeout(() => {
        router.replace(`/dashboard/${storeSlug}/billing`, { scroll: false });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router, storeSlug]);

  // Auto-dismiss the alert after 15 seconds
  useEffect(() => {
    if (showAlert) {
      const timer = setTimeout(() => {
        setShowAlert(false);
      }, 15000);

      return () => clearTimeout(timer);
    }
  }, [showAlert]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and view your billing history
        </p>
      </div>

      {/* Payment Result Alert */}
      {showAlert && paymentResult?.status === "success" && (
        <Alert className="border-green-500/50 bg-green-50 text-green-900">
          <CheckCircle2 className="size-4 text-green-600" />
          <AlertTitle>Payment Successful!</AlertTitle>
          <AlertDescription>
            {isVerifying
              ? "Confirming your payment... This may take a few seconds."
              : paymentResult.message ||
                "Your subscription has been upgraded to Pro. Thank you for your purchase!"}
            {paymentResult.transactionId && (
              <span className="block mt-1 text-xs text-green-700">
                Transaction ID: {paymentResult.transactionId}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {showAlert && paymentResult?.status === "failed" && (
        <Alert className="border-red-500/50 bg-red-50 text-red-900">
          <AlertCircle className="size-4 text-red-600" />
          <AlertTitle>Payment Failed</AlertTitle>
          <AlertDescription>
            {paymentResult.message ||
              "Your payment could not be processed. Please try again."}
          </AlertDescription>
        </Alert>
      )}

      {showAlert && paymentResult?.status === "cancelled" && (
        <Alert className="border-amber-500/50 bg-amber-50 text-amber-900">
          <XCircle className="size-4 text-amber-600" />
          <AlertTitle>Payment Cancelled</AlertTitle>
          <AlertDescription>
            Your payment was cancelled. You can try again anytime.
          </AlertDescription>
        </Alert>
      )}

      {/* Subscription Status Card */}
      <BillingStatusCard
        subscription={subscription}
        currency={currency}
        storeSlug={storeSlug}
      />

      {/* Subscription Management Actions (Cancel/Resume/Manage) */}
      <SubscriptionActions subscription={subscription} tenantId={tenantId} />

      {/* Plan Comparison - show for non-Pro users and cancelled/past_due/expired Pro users */}
      {(subscription.plan !== "pro" ||
        subscription.status === "cancelled" ||
        subscription.status === "past_due" ||
        subscription.status === "expired") && (
        <PlanComparison
          subscription={subscription}
          currency={currency}
          tenantId={tenantId}
          storeSlug={storeSlug}
        />
      )}

      {/* Billing History (Invoices) */}
      <InvoiceList
        invoices={invoices}
        total={invoicesTotal}
        currency={currency}
        hasStripeSubscription={subscription.hasStripeSubscription}
        onViewInvoice={handleViewInvoice}
        onDownloadInvoice={handleDownloadInvoice}
      />

      {/* Invoice Detail Dialog */}
      <InvoiceDetailDialog
        invoice={selectedInvoice}
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        currency={currency}
      />
    </div>
  );
}
