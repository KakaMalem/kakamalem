"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  Check,
  Clock,
  AlertCircle,
  ExternalLink,
  Loader2,
  ArrowLeft,
  Wallet,
  CheckCircle,
  Shield,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { submitTransactionHash } from "@/lib/actions/crypto-payments";
import {
  NETWORK_INFO,
  getTransactionExplorerUrl,
} from "@/lib/payments/crypto/types";
import type { CryptoNetwork, CryptoPaymentStatus } from "@/lib/db/schema";

interface CryptoPaymentClientProps {
  storeSlug: string;
  storeName: string;
  orderId: string;
  orderNumber: string;
  cryptoPayment: {
    id: string;
    network: CryptoNetwork;
    walletAddress: string;
    expectedAmount: string;
    originalAmountAfn: string | null;
    exchangeRate: string | null;
    status: CryptoPaymentStatus;
    expiresAt: string | null;
    transactionHash: string | null;
  };
  successUrl: string;
}

export function CryptoPaymentClient({
  storeSlug,
  storeName,
  orderId,
  orderNumber,
  cryptoPayment,
  successUrl,
}: CryptoPaymentClientProps) {
  const router = useRouter();
  const [copied, setCopied] = useState<"address" | "amount" | null>(null);
  const [txHash, setTxHash] = useState(cryptoPayment.transactionHash || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [status, setStatus] = useState(cryptoPayment.status);
  const [showManualInput, setShowManualInput] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [detectionMessage, setDetectionMessage] = useState<string | null>(null);

  const networkInfo = NETWORK_INFO[cryptoPayment.network];
  const supportsAutoDetection = cryptoPayment.network === "trc20";
  const amount = parseFloat(cryptoPayment.expectedAmount);

  // Generate QR code
  useEffect(() => {
    QRCode.toDataURL(cryptoPayment.walletAddress, {
      width: 200,
      margin: 2,
      color: { dark: "#18181b", light: "#ffffff" },
    })
      .then(setQrCodeUrl)
      .catch(console.error);
  }, [cryptoPayment.walletAddress]);

  // Countdown timer
  useEffect(() => {
    if (!cryptoPayment.expiresAt || status !== "pending") return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(cryptoPayment.expiresAt!).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft(0);
        setStatus("expired");
      } else {
        setTimeLeft(Math.floor(diff / 1000));
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [cryptoPayment.expiresAt, status]);

  // Auto-detect TRC20 payments
  useEffect(() => {
    if (status !== "pending" || !supportsAutoDetection) return;

    setIsAutoDetecting(true);
    let mounted = true;

    const checkPayment = async () => {
      try {
        const response = await fetch(
          `/api/crypto/check-payment?id=${cryptoPayment.id}`
        );
        const data = await response.json();
        if (!mounted) return;

        if (data.detected) {
          if (data.status === "verified") {
            setStatus("verified");
            setTxHash(data.transactionHash || "");
            setDetectionMessage("Payment verified!");
            toast.success("Payment verified!");
          } else if (data.status === "submitted") {
            setStatus("submitted");
            setTxHash(data.transactionHash || "");
            setDetectionMessage("Payment detected, confirming...");
            toast.success("Payment detected!");
          }
        } else if (data.status === "expired") {
          setStatus("expired");
        }
      } catch (error) {
        console.error("Auto-detection error:", error);
      }
    };

    checkPayment();
    const pollInterval = setInterval(checkPayment, 15000);

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      setIsAutoDetecting(false);
    };
  }, [status, supportsAutoDetection, cryptoPayment.id]);

  // Poll for verification when submitted
  useEffect(() => {
    if (status !== "submitted") return;
    const pollInterval = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(pollInterval);
  }, [status, router]);

  const copyToClipboard = useCallback(
    async (text: string, type: "address" | "amount") => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(type);
        toast.success("Copied");
        setTimeout(() => setCopied(null), 2000);
      } catch {
        toast.error("Failed to copy");
      }
    },
    []
  );

  const handleSubmitTxHash = async () => {
    if (!txHash.trim()) {
      toast.error("Please enter a transaction hash");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await submitTransactionHash(
        cryptoPayment.id,
        txHash.trim()
      );
      if (result.success) {
        setStatus("submitted");
        toast.success("Transaction submitted");
      } else {
        toast.error(result.error || "Please try again.");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const retryUrl = `/store/${storeSlug}/checkout/payment?order=${orderId}`;

  // ── Terminal states ──────────────────────────────────────────────────────

  if (status === "expired") {
    return (
      <Shell>
        <StatusScreen
          icon={<Clock className="size-6 text-zinc-400" />}
          iconBg="bg-zinc-100"
          title="Session expired"
          description="This payment window has closed. You can start a new one — your order is still saved."
        >
          <Button className="w-full" asChild>
            <Link href={retryUrl}>Retry Payment</Link>
          </Button>
        </StatusScreen>
      </Shell>
    );
  }

  if (status === "rejected") {
    return (
      <Shell>
        <StatusScreen
          icon={<XCircle className="size-6 text-red-500" />}
          iconBg="bg-red-50"
          title="Payment rejected"
          description="We couldn't verify this transaction. Please try again or contact support."
        >
          <Button className="w-full" asChild>
            <Link href={retryUrl}>Try Again</Link>
          </Button>
        </StatusScreen>
      </Shell>
    );
  }

  if (status === "verified") {
    return (
      <Shell>
        <StatusScreen
          icon={<CheckCircle className="size-6 text-emerald-600" />}
          iconBg="bg-emerald-50"
          title="Payment confirmed"
          description="Your payment has been verified. Your order is being processed."
        >
          <Button className="w-full" asChild>
            <Link href={successUrl}>View Order</Link>
          </Button>
        </StatusScreen>
      </Shell>
    );
  }

  if (status === "submitted") {
    return (
      <Shell>
        <StatusScreen
          icon={<Loader2 className="size-6 text-blue-600 animate-spin" />}
          iconBg="bg-blue-50"
          title="Verifying payment"
          description="We're confirming your transaction on the blockchain. This usually takes a few minutes."
        >
          {/* Transaction details */}
          <div className="w-full rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 space-y-3 text-sm">
            <Row label="Order" value={`#${orderNumber}`} />
            <Row label="Amount" value={`${amount.toFixed(2)} USDT`} />
            <Row label="Network" value={networkInfo.name} />
            {txHash && (
              <div className="border-t border-zinc-100 pt-3">
                <span className="text-zinc-500 text-xs">Transaction Hash</span>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-[11px] break-all text-zinc-700 bg-white rounded border border-zinc-200 px-2 py-1.5">
                    {txHash}
                  </code>
                  <a
                    href={getTransactionExplorerUrl(
                      txHash,
                      cryptoPayment.network
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-zinc-700 transition-colors"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-zinc-400 text-center">
            This page updates automatically. You can close it and check your
            order later.
          </p>
        </StatusScreen>
      </Shell>
    );
  }

  // ── Pending state — payment instructions ─────────────────────────────

  return (
    <Shell>
      <div className="w-full max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="-ml-2" asChild>
            <Link href={retryUrl}>
              <ArrowLeft className="mr-1 size-4" />
              Back
            </Link>
          </Button>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Shield className="size-3" />
            Escrow protected
          </div>
        </div>

        {/* Amount */}
        <div className="text-center space-y-1">
          <p className="text-sm text-zinc-500">Send exactly</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl font-bold tracking-tight text-zinc-900">
              {amount.toFixed(2)}
            </span>
            <Badge
              variant="outline"
              className="text-xs font-semibold tracking-wider"
            >
              USDT
            </Badge>
          </div>
          <p className="text-xs text-zinc-400">
            via {networkInfo.name} network
          </p>
        </div>

        {/* Timer */}
        {timeLeft !== null && timeLeft > 0 && (
          <div
            className={`flex items-center justify-center gap-2 text-sm font-medium ${
              timeLeft < 300 ? "text-red-600" : "text-zinc-500"
            }`}
          >
            <Clock className="size-3.5" />
            {formatTime(timeLeft)} remaining
          </div>
        )}

        {/* QR + Address card */}
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          {/* QR Code */}
          {qrCodeUrl && (
            <div className="flex justify-center py-6 bg-zinc-50/50 border-b border-zinc-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCodeUrl}
                alt="Wallet QR"
                className="size-44 rounded-xl"
              />
            </div>
          )}

          {/* Wallet address */}
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Wallet Address
              </span>
              <Badge variant="outline" className="text-[10px]">
                {networkInfo.name}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] break-all text-zinc-700 bg-zinc-50 rounded-lg border border-zinc-100 px-3 py-2.5 font-mono">
                {cryptoPayment.walletAddress}
              </code>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 size-9"
                onClick={() =>
                  copyToClipboard(cryptoPayment.walletAddress, "address")
                }
              >
                {copied === "address" ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </div>
            {/* Copy amount button */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-zinc-500 hover:text-zinc-700"
              onClick={() => copyToClipboard(amount.toFixed(2), "amount")}
            >
              {copied === "amount" ? (
                <Check className="mr-1.5 size-3 text-emerald-500" />
              ) : (
                <Copy className="mr-1.5 size-3" />
              )}
              Copy amount: {amount.toFixed(2)} USDT
            </Button>
          </div>
        </div>

        {/* Instructions */}
        <div className="rounded-xl bg-amber-50/70 border border-amber-200/50 p-4">
          <div className="flex gap-3">
            <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[13px] text-amber-900 space-y-1.5">
              <p>
                Send <strong>exactly {amount.toFixed(2)} USDT</strong> on the{" "}
                <strong>{networkInfo.name}</strong> network.
              </p>
              <p className="text-amber-700">
                Wrong amount or network will delay verification.
              </p>
            </div>
          </div>
        </div>

        {/* Auto-detection indicator */}
        {supportsAutoDetection && (
          <div className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 p-4">
            <div className="flex size-9 items-center justify-center rounded-full bg-blue-50">
              {isAutoDetecting ? (
                <Loader2 className="size-4 text-blue-600 animate-spin" />
              ) : (
                <Wallet className="size-4 text-blue-600" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-zinc-700">
                {isAutoDetecting
                  ? "Listening for payment..."
                  : "Auto-detection ready"}
              </p>
              <p className="text-xs text-zinc-500">
                {detectionMessage ||
                  "Your payment will be detected automatically once sent"}
              </p>
            </div>
          </div>
        )}

        {/* Manual tx hash input */}
        <div className="rounded-xl border border-zinc-100 overflow-hidden">
          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-zinc-500 hover:bg-zinc-50 transition-colors"
          >
            <span>
              {supportsAutoDetection
                ? "Submit transaction hash manually"
                : "Submit transaction hash"}
            </span>
            <span className="text-xs text-zinc-400">
              {showManualInput ? "Hide" : "Show"}
            </span>
          </button>
          {(showManualInput || !supportsAutoDetection) && (
            <div className="px-4 pb-4 space-y-3 border-t border-zinc-100 pt-3">
              <Input
                placeholder="Paste your transaction hash (TxID)..."
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                className="font-mono text-xs"
                disabled={isSubmitting}
              />
              <Button
                className="w-full"
                size="sm"
                onClick={handleSubmitTxHash}
                disabled={isSubmitting || !txHash.trim()}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 size-3.5 animate-spin" />
                ) : (
                  <Check className="mr-2 size-3.5" />
                )}
                {isSubmitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          )}
        </div>

        {/* Order reference */}
        <p className="text-center text-xs text-zinc-400">
          Order #{orderNumber} &middot; {storeName}
        </p>
      </div>
    </Shell>
  );
}

// ── Shared layout wrapper ────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[80vh] flex items-start justify-center px-4 py-12 sm:py-16">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

// ── Status screen (verified, expired, rejected, submitted) ───────────────

function StatusScreen({
  icon,
  iconBg,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center space-y-6">
      <div
        className={`flex size-14 items-center justify-center rounded-2xl ${iconBg}`}
      >
        {icon}
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
        <p className="text-sm text-zinc-500 max-w-xs">{description}</p>
      </div>
      {children}
    </div>
  );
}

// ── Info row ──────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium text-zinc-900">{value}</span>
    </div>
  );
}
