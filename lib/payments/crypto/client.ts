/**
 * USDT Crypto Payment Client
 *
 * Self-hosted USDT wallet payment system with manual verification.
 * Does NOT actually process payments - creates sessions for manual verification.
 */

import type {
  PaymentGatewayProvider,
  CreatePaymentSessionParams,
  PaymentSessionResult,
  VerifyPaymentParams,
  PaymentVerificationResult,
  WebhookVerificationResult,
  GatewayCredentials,
} from "../types";
import { generateQrCodeData, getWalletForNetwork } from "./types";
import type { CryptoNetwork, UsdtWalletConfig } from "@/lib/db/schema";
import { db } from "@/lib/db";
import { cryptoPayments, paymentSessions } from "@/lib/db/schema";
import { getExchangeRates } from "@/lib/currency";
import { eq } from "drizzle-orm";

// =============================================================================
// CRYPTO USDT CLIENT
// =============================================================================

export class CryptoUsdtClient implements PaymentGatewayProvider {
  readonly gateway = "crypto_usdt" as const;

  /**
   * Create a crypto payment session
   *
   * Unlike other gateways, this doesn't create an external session.
   * Instead, it creates a local record with wallet details for the customer.
   */
  async createPaymentSession(
    params: CreatePaymentSessionParams,
    credentials: GatewayCredentials
  ): Promise<PaymentSessionResult> {
    try {
      // Get USDT wallet config from credentials
      const walletConfig = credentials.settings?.walletConfig as
        | UsdtWalletConfig
        | undefined;

      if (!walletConfig) {
        return {
          success: false,
          error: "Crypto payment not configured",
        };
      }

      // Get selected network from metadata (default to TRC20 - lowest fees)
      const network = (params.metadata?.network as CryptoNetwork) || "trc20";

      // Get wallet for the selected network
      const wallet = getWalletForNetwork(walletConfig, network);

      if (!wallet) {
        return {
          success: false,
          error: `${network.toUpperCase()} wallet not configured`,
        };
      }

      // Get real-time exchange rate from currency service
      // USDT ≈ USD (stablecoin), so we use the AFN to USD rate
      const rates = await getExchangeRates();
      const afnToUsdRate = rates.USD || 0.011; // 1 AFN = X USD (fallback ~90 AFN per USD)

      // Exchange rate: how many AFN per 1 USDT (inverse of AFN to USD rate)
      // If 1 AFN = 0.011 USD, then 1 USD/USDT = 90.9 AFN
      const exchangeRate = afnToUsdRate > 0 ? 1 / afnToUsdRate : 90;

      // Convert AFN to USDT: amount in AFN * (1 USDT / X AFN)
      const usdtAmount = Number((params.amount * afnToUsdRate).toFixed(2));

      // Check minimum amount
      const minAmount = walletConfig.minAmount || 1;
      if (usdtAmount < minAmount) {
        return {
          success: false,
          error: `Minimum payment amount is ${minAmount} USDT`,
        };
      }

      // Calculate expiration (default 60 minutes)
      const expirationMinutes = walletConfig.expirationMinutes || 60;
      const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

      // Generate QR code data
      const qrCodeData = generateQrCodeData(
        network,
        wallet.address,
        usdtAmount
      );

      // Generate a unique session ID
      const sessionId = `crypto_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Return session data (the actual crypto_payments record is created by the action)
      return {
        success: true,
        sessionId,
        // No external payment URL - customer views instructions on our page
        paymentUrl: undefined,
        gatewayResponse: {
          network,
          walletAddress: wallet.address,
          expectedAmount: usdtAmount,
          currency: "USDT",
          exchangeRate,
          originalAmountAfn: params.amount,
          expiresAt: expiresAt.toISOString(),
          qrCodeData,
        },
      };
    } catch (error) {
      console.error("[CryptoUsdtClient] createPaymentSession error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Verify a crypto payment
   *
   * For crypto, we check our local crypto_payments table
   * to see if an admin has verified the transaction.
   */
  async verifyPayment(
    params: VerifyPaymentParams,
    _credentials: GatewayCredentials
  ): Promise<PaymentVerificationResult> {
    try {
      // Get the payment session
      const session = await db.query.paymentSessions.findFirst({
        where: eq(paymentSessions.gatewaySessionId, params.sessionId),
      });

      if (!session) {
        return {
          success: false,
          paid: false,
          status: "failed",
          error: "Session not found",
        };
      }

      // Get the crypto payment record
      const cryptoPayment = await db.query.cryptoPayments.findFirst({
        where: eq(cryptoPayments.paymentSessionId, session.id),
      });

      if (!cryptoPayment) {
        return {
          success: true,
          paid: false,
          status: "pending",
        };
      }

      // Map crypto payment status to payment verification status
      const statusMap: Record<
        string,
        "pending" | "completed" | "failed" | "cancelled" | "expired"
      > = {
        pending: "pending",
        submitted: "pending",
        verified: "completed",
        expired: "expired",
        rejected: "failed",
      };

      const status = statusMap[cryptoPayment.status] || "pending";
      const paid = cryptoPayment.status === "verified";

      return {
        success: true,
        paid,
        status,
        transactionId: cryptoPayment.transactionHash || undefined,
        amount: cryptoPayment.expectedAmount
          ? parseFloat(cryptoPayment.expectedAmount)
          : undefined,
        currency: "USDT",
        gatewayResponse: {
          cryptoPaymentId: cryptoPayment.id,
          network: cryptoPayment.network,
          status: cryptoPayment.status,
          transactionHash: cryptoPayment.transactionHash,
          verifiedAt: cryptoPayment.verifiedAt,
        },
      };
    } catch (error) {
      console.error("[CryptoUsdtClient] verifyPayment error:", error);
      return {
        success: false,
        paid: false,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Verify webhook - not applicable for self-hosted crypto
   *
   * Crypto payments use manual verification, not webhooks.
   */
  async verifyWebhook(
    _payload: unknown,
    _headers: Record<string, string>,
    _webhookSecret?: string
  ): Promise<WebhookVerificationResult> {
    // Crypto payments don't use webhooks - manual verification only
    return {
      valid: false,
      error: "Crypto payments use manual verification, not webhooks",
    };
  }

  // Note: No refund method - crypto payments are non-refundable via the gateway
  // Refunds must be handled manually by sending crypto back to customer
}

// Export singleton instance
export const cryptoUsdtClient = new CryptoUsdtClient();
