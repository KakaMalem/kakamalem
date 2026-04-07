import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import { resolveTenant } from "@/lib/db/queries/tenants";
import { getStoreBasePath } from "@/lib/utils/store-path";
import { db } from "@/lib/db";
import { paymentSessions, cryptoPayments, orders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { CryptoPaymentClient } from "./crypto-payment-client";
import { getWalletForNetwork } from "@/lib/payments/crypto/types";

interface CryptoPaymentPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    session?: string;
  }>;
}

export async function generateMetadata({
  params,
}: CryptoPaymentPageProps): Promise<Metadata> {
  const { slug } = await params;
  const store = await resolveTenant(slug);

  if (!store) {
    return { title: "Payment - Store Not Found" };
  }

  return {
    title: `Pay with USDT - ${store.name}`,
    description: `Complete your USDT payment at ${store.name}`,
    icons: {
      icon: "/icons/favicon-32x32.png",
      apple: "/icons/apple-touch-icon.png",
    },
  };
}

export default async function CryptoPaymentPage({
  params,
  searchParams,
}: CryptoPaymentPageProps) {
  const { slug } = await params;
  const { session: sessionId } = await searchParams;

  // Fetch store
  const store = await resolveTenant(slug);
  if (!store) {
    notFound();
  }

  const basePath = await getStoreBasePath(store.slug);

  // Handle inactive stores gracefully - redirect instead of 404
  if (store.status !== "active") {
    redirect(`${basePath}`);
  }

  // Redirect if no session ID
  if (!sessionId) {
    redirect(`${basePath}/checkout`);
  }

  // Get the payment session - verify it belongs to this tenant
  const [paymentSession] = await db
    .select()
    .from(paymentSessions)
    .where(
      and(
        eq(paymentSessions.id, sessionId),
        eq(paymentSessions.tenantId, store.id)
      )
    )
    .limit(1);

  if (!paymentSession) {
    // Session not found or doesn't belong to this store
    redirect(`${basePath}/checkout`);
  }

  // Get the crypto payment record
  const [cryptoPayment] = await db
    .select()
    .from(cryptoPayments)
    .where(eq(cryptoPayments.paymentSessionId, sessionId))
    .limit(1);

  if (!cryptoPayment) {
    // No crypto payment record - redirect to payment method selection
    redirect(`${basePath}/checkout/payment?order=${paymentSession.orderId}`);
  }

  // Check if already verified
  if (cryptoPayment.status === "verified") {
    redirect(`${basePath}/checkout/success?order=${paymentSession.orderId}`);
  }

  // Check if expired
  const isExpired =
    cryptoPayment.expiresAt && new Date(cryptoPayment.expiresAt) < new Date();
  if (isExpired && cryptoPayment.status === "pending") {
    // Update status to expired
    await db
      .update(cryptoPayments)
      .set({ status: "expired" })
      .where(eq(cryptoPayments.id, cryptoPayment.id));
  }

  // Get order details - we can fetch directly since the payment session proves ownership
  if (!paymentSession.orderId) {
    redirect(`${basePath}`);
  }

  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
    })
    .from(orders)
    .where(
      and(eq(orders.id, paymentSession.orderId), eq(orders.tenantId, store.id))
    )
    .limit(1);

  if (!order) {
    redirect(`${basePath}`);
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white sm:bg-zinc-50">
      <div className="flex min-h-screen flex-col items-center">
        {/* Store identity */}
        <div className="w-full pt-6 pb-2 sm:pt-10 sm:pb-4 flex justify-center">
          <Link
            href={`/store/${store.slug}`}
            className="flex items-center gap-2.5 opacity-80 hover:opacity-100 transition-opacity"
          >
            {store.logoUrl ? (
              <Image
                src={store.logoUrl}
                alt={store.name}
                width={32}
                height={32}
                className="rounded-lg"
              />
            ) : (
              <div className="flex size-8 items-center justify-center rounded-lg bg-zinc-900 text-white text-sm font-bold">
                {store.name.charAt(0)}
              </div>
            )}
            <span className="font-semibold text-zinc-700">{store.name}</span>
          </Link>
        </div>

        {/* Payment content */}
        <main className="flex-1 w-full sm:flex sm:justify-center sm:px-4 lg:px-8">
          <div className="w-full md:max-w-4xl sm:max-w-lg sm:my-4 sm:rounded-2xl sm:border sm:border-zinc-200 sm:bg-white sm:shadow-sm">
            <CryptoPaymentClient
              storeSlug={store.slug}
              storeName={store.name}
              orderId={order.id}
              orderNumber={order.orderNumber}
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
              successUrl={
                paymentSession.successUrl ||
                `${basePath}/checkout/success?order=${order.id}`
              }
            />
          </div>
        </main>

        {/* Powered by */}
        <div className="w-full py-4 sm:py-6 text-center">
          <Link
            href="/"
            className="text-xs text-zinc-400 hover:text-zinc-500 transition-colors"
          >
            Powered by <span className="font-medium">Kaka Malem</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
