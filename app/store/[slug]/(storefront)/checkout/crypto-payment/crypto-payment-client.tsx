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
  Wallet,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [status, setStatus] = useState(cryptoPayment.status);
  const [detectionMessage, setDetectionMessage] = useState<string | null>(null);
  const isAutoDetecting = status === "pending";

  const networkInfo = NETWORK_INFO[cryptoPayment.network];
  const amount = parseFloat(cryptoPayment.expectedAmount);

  // Generate QR code — larger for desktop
  useEffect(() => {
    QRCode.toDataURL(cryptoPayment.walletAddress, {
      width: 280,
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

  // Auto-detect payments on blockchain (TRC20)
  useEffect(() => {
    if (status !== "pending") return;

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
    };
  }, [status, cryptoPayment.id]);

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
          <Button className="w-full sm:w-auto sm:px-8" asChild>
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
          <Button className="w-full sm:w-auto sm:px-8" asChild>
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
          <Button className="w-full sm:w-auto sm:px-8" asChild>
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
          <div className="w-full max-w-sm rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 sm:p-5 space-y-3 text-sm">
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
    <div className="px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-10">
      {/* Amount + Timer — always at top */}
      <div className="text-center mb-6 sm:mb-8">
        <p className="text-sm text-zinc-500 mb-1">Send exactly</p>
        <div className="flex items-center justify-center gap-3">
          <span className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900">
            {amount.toFixed(2)}
          </span>
          <Badge
            variant="outline"
            className="text-xs font-semibold tracking-wider"
          >
            USDT
          </Badge>
        </div>
        <p className="text-xs text-zinc-400 mt-1">
          via {networkInfo.name} network
        </p>

        {/* Timer */}
        {timeLeft !== null && timeLeft > 0 && (
          <div
            className={`inline-flex items-center gap-1.5 mt-3 text-xs font-medium ${
              timeLeft < 300 ? "text-red-600" : "text-zinc-400"
            }`}
          >
            <Clock className="size-3" />
            {formatTime(timeLeft)} remaining
          </div>
        )}
      </div>

      {/* Two-column on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-3xl mx-auto">
        {/* Left: QR Code */}
        <div className="flex flex-col items-center">
          {qrCodeUrl && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCodeUrl}
                alt="Wallet QR"
                className="size-44 sm:size-52 md:size-56 rounded-xl"
              />
            </div>
          )}

          {/* Detection status — below QR on mobile, below QR on desktop */}
          <div className="flex items-center gap-2.5 mt-4 rounded-full border border-zinc-100 bg-zinc-50/80 px-4 py-2">
            {isAutoDetecting ? (
              <Loader2 className="size-3.5 text-blue-600 animate-spin" />
            ) : (
              <Wallet className="size-3.5 text-blue-600" />
            )}
            <span className="text-xs font-medium text-zinc-600">
              {detectionMessage ||
                (isAutoDetecting
                  ? "Listening for payment..."
                  : "Auto-detection ready")}
            </span>
          </div>
        </div>

        {/* Right: Address + Instructions */}
        <div className="space-y-4">
          {/* Wallet address */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Wallet Address
              </span>
              <Badge variant="outline" className="text-[10px]">
                {networkInfo.name}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] sm:text-xs break-all text-zinc-700 bg-zinc-50 rounded-lg border border-zinc-100 px-3 py-2.5 font-mono leading-relaxed">
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

          {/* Instructions */}
          <div className="rounded-xl bg-amber-50/70 border border-amber-200/50 p-4">
            <div className="flex gap-3">
              <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[13px] text-amber-900 space-y-1">
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

          {/* Order ref */}
          <p className="text-center text-xs text-zinc-400">
            Order #{orderNumber} &middot; {storeName}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Shared layout wrapper ────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center px-4 py-12 sm:py-16 md:py-20 min-h-[60vh]">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

// ── Status screen ────────────────────────────────────────────────────────

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
    <div className="flex flex-col items-center text-center space-y-5 sm:space-y-6">
      <div
        className={`flex size-14 sm:size-16 items-center justify-center rounded-2xl ${iconBg}`}
      >
        {icon}
      </div>
      <div className="space-y-2">
        <h1 className="text-lg sm:text-xl font-semibold text-zinc-900">
          {title}
        </h1>
        <p className="text-sm text-zinc-500 max-w-xs mx-auto">{description}</p>
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
