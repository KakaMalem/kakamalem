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
  Crown,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { submitTransactionHash } from "@/lib/actions/crypto-payments";
import {
  NETWORK_INFO,
  getTransactionExplorerUrl,
} from "@/lib/payments/crypto/types";
import type { CryptoNetwork, CryptoPaymentStatus } from "@/lib/db/schema";

interface SubscriptionCryptoPaymentClientProps {
  storeSlug: string;
  storeName: string;
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
}

export function SubscriptionCryptoPaymentClient({
  storeSlug,
  storeName,
  cryptoPayment,
}: SubscriptionCryptoPaymentClientProps) {
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
  const originalAmount = cryptoPayment.originalAmountAfn
    ? parseFloat(cryptoPayment.originalAmountAfn)
    : null;
  const _exchangeRate = cryptoPayment.exchangeRate
    ? parseFloat(cryptoPayment.exchangeRate)
    : null;

  // Generate QR code
  useEffect(() => {
    // Generate QR for wallet address
    QRCode.toDataURL(cryptoPayment.walletAddress, {
      width: 200,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
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

  // Auto-detect incoming payments for TRC20 (polls TronGrid)
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
            toast.success("Payment verified!", {
              description: "Your Pro subscription is now active.",
            });
          } else if (data.status === "submitted") {
            setStatus("submitted");
            setTxHash(data.transactionHash || "");
            setDetectionMessage("Payment detected, confirming...");
            toast.success("Payment detected!", {
              description: "Waiting for blockchain confirmation...",
            });
          }
        } else if (data.status === "expired") {
          setStatus("expired");
        }
      } catch (error) {
        console.error("Auto-detection error:", error);
      }
    };

    // Initial check
    checkPayment();

    // Poll every 15 seconds
    const pollInterval = setInterval(checkPayment, 15000);

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      setIsAutoDetecting(false);
    };
  }, [status, supportsAutoDetection, cryptoPayment.id]);

  // Poll for verification when submitted (for all networks)
  useEffect(() => {
    if (status !== "submitted") return;

    const pollInterval = setInterval(() => {
      router.refresh();
    }, 10000); // Check every 10 seconds

    return () => clearInterval(pollInterval);
  }, [status, router]);

  const copyToClipboard = useCallback(
    async (text: string, type: "address" | "amount") => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(type);
        toast.success("Copied to clipboard");
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
        toast.success("Transaction hash submitted", {
          description: "We will verify your payment shortly.",
        });
      } else {
        toast.error("Failed to submit", {
          description: result.error || "Please try again.",
        });
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Expired state
  if (status === "expired") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="size-8 text-destructive" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Payment Expired</h1>
          <p className="mt-2 text-muted-foreground">
            This payment session has expired. Please start a new upgrade.
          </p>
        </div>
        <Button variant="outline" className="w-full" asChild>
          <Link href={`/dashboard/${storeSlug}/billing/upgrade`}>
            <ArrowLeft className="mr-2 size-4" />
            Try Again
          </Link>
        </Button>
      </div>
    );
  }

  // Rejected state
  if (status === "rejected") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="size-8 text-destructive" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Payment Rejected</h1>
          <p className="mt-2 text-muted-foreground">
            Your payment could not be verified. Please contact support or try
            another payment method.
          </p>
        </div>
        <Button variant="outline" className="w-full" asChild>
          <Link href={`/dashboard/${storeSlug}/billing/upgrade`}>
            <ArrowLeft className="mr-2 size-4" />
            Try Another Payment Method
          </Link>
        </Button>
      </div>
    );
  }

  // Submitted state - waiting for verification
  if (status === "submitted") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-100">
            <Clock className="size-8 text-amber-600" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Payment Submitted</h1>
          <p className="mt-2 text-muted-foreground">
            Your transaction is being verified. This usually takes a few
            minutes.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Store</span>
              <span className="font-medium">{storeName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan</span>
              <div className="flex items-center gap-2">
                <Crown className="size-4 text-primary" />
                <span className="font-medium">Pro</span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">{amount.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Network</span>
              <Badge variant="outline">{networkInfo.name}</Badge>
            </div>
            {txHash && (
              <div className="border-t pt-4">
                <span className="text-sm text-muted-foreground">
                  Transaction Hash
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-xs break-all bg-muted p-2 rounded">
                    {txHash}
                  </code>
                  <a
                    href={getTransactionExplorerUrl(
                      txHash,
                      cryptoPayment.network
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Alert>
          <Loader2 className="size-4 animate-spin" />
          <AlertTitle>Verifying Payment</AlertTitle>
          <AlertDescription>
            Please wait while we verify your transaction on the blockchain. This
            page will update automatically.
          </AlertDescription>
        </Alert>

        <Button variant="outline" className="w-full" asChild>
          <Link href={`/dashboard/${storeSlug}/billing`}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Billing
          </Link>
        </Button>
      </div>
    );
  }

  // Verified state
  if (status === "verified") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="size-8 text-green-600" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Payment Verified</h1>
          <p className="mt-2 text-muted-foreground">
            Your Pro subscription is now active. Enjoy unlimited products!
          </p>
        </div>
        <Button className="w-full" asChild>
          <Link href={`/dashboard/${storeSlug}/billing`}>
            <Crown className="mr-2 size-4" />
            View Subscription
          </Link>
        </Button>
      </div>
    );
  }

  // Pending state - show payment instructions
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/${storeSlug}/billing/upgrade`}>
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pay with USDT</h1>
          <p className="text-muted-foreground">
            Complete your Pro subscription payment
          </p>
        </div>
      </div>

      {/* Timer */}
      {timeLeft !== null && timeLeft > 0 && (
        <Alert variant={timeLeft < 300 ? "destructive" : "default"}>
          <Clock className="size-4" />
          <AlertTitle>Time Remaining</AlertTitle>
          <AlertDescription>
            {formatTime(timeLeft)} - Complete your payment before this expires
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Crown className="size-5 text-primary" />
              <span>Pro Subscription</span>
            </div>
            <Badge variant="outline">{networkInfo.name}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Amount */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {amount.toFixed(2)} USDT
              </div>
              {originalAmount && (
                <div className="text-sm text-muted-foreground mt-1">
                  = {originalAmount.toLocaleString()} AFN
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2"
              onClick={() => copyToClipboard(amount.toFixed(2), "amount")}
            >
              {copied === "amount" ? (
                <Check className="mr-2 size-4 text-green-500" />
              ) : (
                <Copy className="mr-2 size-4" />
              )}
              Copy Amount
            </Button>
          </div>

          {/* QR Code - using img for data URL from qrcode library */}
          {qrCodeUrl && (
            <div className="flex justify-center">
              <div className="rounded-lg border bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCodeUrl}
                  alt="Payment QR Code"
                  className="size-48"
                />
              </div>
            </div>
          )}

          {/* Wallet Address */}
          <div>
            <Label className="text-sm text-muted-foreground">
              Wallet Address ({networkInfo.fullName})
            </Label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 rounded border bg-muted px-3 py-2 text-xs break-all">
                {cryptoPayment.walletAddress}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  copyToClipboard(cryptoPayment.walletAddress, "address")
                }
              >
                {copied === "address" ? (
                  <Check className="size-4 text-green-500" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <Alert>
            <AlertCircle className="size-4" />
            <AlertTitle>Important</AlertTitle>
            <AlertDescription className="text-sm">
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>
                  Send <strong>exactly {amount.toFixed(2)} USDT</strong> on the{" "}
                  <strong>{networkInfo.name}</strong> network
                </li>
                <li>Sending a different amount may delay verification</li>
                <li>Do not send from an exchange - use a personal wallet</li>
                {supportsAutoDetection ? (
                  <li className="text-green-600 font-medium">
                    Payment will be detected automatically after sending
                  </li>
                ) : (
                  <li>After sending, enter your transaction hash below</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Auto-detection status (TRC20 only) */}
      {supportsAutoDetection && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                {isAutoDetecting ? (
                  <Loader2 className="size-6 text-primary animate-spin" />
                ) : (
                  <Wallet className="size-6 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">
                  {isAutoDetecting
                    ? "Waiting for payment..."
                    : "Auto-detection ready"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {detectionMessage ||
                    "Send the payment and it will be detected automatically"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Transaction Hash Input (fallback) */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setShowManualInput(!showManualInput)}
        >
          <CardTitle className="flex items-center justify-between text-base">
            <span className="text-muted-foreground">
              {supportsAutoDetection
                ? "Having trouble? Enter transaction hash manually"
                : "Submit Transaction"}
            </span>
            <Button variant="ghost" size="sm">
              {showManualInput ? "Hide" : "Show"}
            </Button>
          </CardTitle>
        </CardHeader>
        {(showManualInput || !supportsAutoDetection) && (
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="txHash">Transaction Hash (TxID)</Label>
              <Input
                id="txHash"
                placeholder="Enter your transaction hash..."
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                className="mt-1 font-mono text-sm"
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Find this in your wallet after the transaction is confirmed
              </p>
            </div>

            <Button
              className="w-full"
              onClick={handleSubmitTxHash}
              disabled={isSubmitting || !txHash.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Check className="mr-2 size-4" />
                  Submit Transaction Hash
                </>
              )}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
