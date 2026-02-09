import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/server";
import { canManageStore } from "@/lib/auth/context";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { db } from "@/lib/db";
import { cryptoPayments, paymentSessions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { SubscriptionCryptoPaymentClient } from "./subscription-crypto-payment-client";
import { getWalletForNetwork } from "@/lib/payments/crypto/types";

// =============================================================================
// SUBSCRIPTION CRYPTO PAYMENT PAGE
// =============================================================================
// Shows USDT payment details for Pro subscription upgrade
// =============================================================================

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string }>;
}

export default async function SubscriptionCryptoPaymentPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const { id: cryptoPaymentId } = await searchParams;

  // Auth check
  await requireAuth();

  // Get tenant
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    redirect("/dashboard");
  }

  // Permission check
  const canManage = await canManageStore(tenant.id);
  if (!canManage) {
    redirect("/dashboard");
  }

  // Redirect if no payment ID
  if (!cryptoPaymentId) {
    redirect(`/dashboard/${slug}/billing`);
  }

  // Get the crypto payment record
  const [cryptoPayment] = await db
    .select()
    .from(cryptoPayments)
    .where(
      and(
        eq(cryptoPayments.id, cryptoPaymentId),
        eq(cryptoPayments.purpose, "subscription"),
        eq(cryptoPayments.tenantId, tenant.id)
      )
    )
    .limit(1);

  if (!cryptoPayment) {
    redirect(`/dashboard/${slug}/billing`);
  }

  // Get the payment session
  const [paymentSession] = await db
    .select()
    .from(paymentSessions)
    .where(eq(paymentSessions.id, cryptoPayment.paymentSessionId))
    .limit(1);

  if (!paymentSession) {
    redirect(`/dashboard/${slug}/billing`);
  }

  // Check if already verified - redirect to billing with success
  if (cryptoPayment.status === "verified") {
    redirect(`/dashboard/${slug}/billing?upgrade=success`);
  }

  // Check if expired
  const isExpired =
    cryptoPayment.expiresAt && new Date(cryptoPayment.expiresAt) < new Date();
  if (isExpired && cryptoPayment.status === "pending") {
    // Update status to expired
    await db
      .update(cryptoPayments)
      .set({ status: "expired", updatedAt: new Date().toISOString() })
      .where(eq(cryptoPayments.id, cryptoPayment.id));
  }

  // Fix for corrupted wallet addresses (stored as "[object Object]" due to bug)
  // Fall back to platform settings if wallet address looks invalid
  let walletAddress = cryptoPayment.walletAddress;
  if (walletAddress.includes("[object") || walletAddress.length < 20) {
    const settings = await db.query.platformSettings.findFirst();
    const wallet = getWalletForNetwork(
      settings?.usdtWalletConfig,
      cryptoPayment.network
    );
    if (wallet?.address) {
      walletAddress = wallet.address;
      // Also fix the database record
      await db
        .update(cryptoPayments)
        .set({
          walletAddress: wallet.address,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(cryptoPayments.id, cryptoPayment.id));
    }
  }

  return (
    <SubscriptionCryptoPaymentClient
      storeSlug={slug}
      storeName={tenant.name}
      cryptoPayment={{
        id: cryptoPayment.id,
        network: cryptoPayment.network,
        walletAddress,
        expectedAmount: cryptoPayment.expectedAmount,
        originalAmountAfn: cryptoPayment.originalAmountAfn,
        exchangeRate: cryptoPayment.exchangeRate,
        status: cryptoPayment.status,
        expiresAt: cryptoPayment.expiresAt,
        transactionHash: cryptoPayment.transactionHash,
      }}
    />
  );
}
