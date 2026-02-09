import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  cryptoPayments,
  paymentSessions,
  tenants,
  invoices,
  billingTransactions,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { checkForIncomingPayment } from "@/lib/payments/crypto/trongrid";

/**
 * API Route: Check for incoming crypto payment
 *
 * Polls TronGrid to detect incoming USDT payments automatically.
 * Called by the client every 10-15 seconds while waiting for payment.
 *
 * GET /api/crypto/check-payment?id=<cryptoPaymentId>
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const cryptoPaymentId = searchParams.get("id");

    if (!cryptoPaymentId) {
      return NextResponse.json(
        { error: "Missing payment ID" },
        { status: 400 }
      );
    }

    // Get the crypto payment record
    const cryptoPayment = await db.query.cryptoPayments.findFirst({
      where: eq(cryptoPayments.id, cryptoPaymentId),
    });

    if (!cryptoPayment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // If already verified or not pending, return current status
    if (cryptoPayment.status !== "pending") {
      return NextResponse.json({
        status: cryptoPayment.status,
        detected: cryptoPayment.status === "verified",
        transactionHash: cryptoPayment.transactionHash,
      });
    }

    // Check if expired
    if (
      cryptoPayment.expiresAt &&
      new Date(cryptoPayment.expiresAt) < new Date()
    ) {
      await db
        .update(cryptoPayments)
        .set({ status: "expired", updatedAt: new Date().toISOString() })
        .where(eq(cryptoPayments.id, cryptoPaymentId));

      return NextResponse.json({
        status: "expired",
        detected: false,
      });
    }

    // Only auto-detect for TRC20 (TronGrid API)
    if (cryptoPayment.network !== "trc20") {
      return NextResponse.json({
        status: "pending",
        detected: false,
        message:
          "Auto-detection only available for TRC20. Please submit transaction hash.",
      });
    }

    // Check TronGrid for incoming payment
    const expectedAmount = parseFloat(cryptoPayment.expectedAmount);
    const createdAt = new Date(cryptoPayment.createdAt);

    const result = await checkForIncomingPayment(
      cryptoPayment.walletAddress,
      expectedAmount,
      createdAt,
      0.02 // 2 cent tolerance for rounding
    );

    if (result.found && result.transaction) {
      // Payment detected! Update the record
      const now = new Date().toISOString();

      await db
        .update(cryptoPayments)
        .set({
          status: "submitted", // Mark as submitted, admin still verifies
          transactionHash: result.transaction.hash,
          submittedAt: now,
          updatedAt: now,
        })
        .where(eq(cryptoPayments.id, cryptoPaymentId));

      // If confirmed on blockchain, we can auto-verify
      if (result.transaction.confirmed) {
        await autoVerifyPayment(cryptoPaymentId, result.transaction.hash);

        return NextResponse.json({
          status: "verified",
          detected: true,
          transactionHash: result.transaction.hash,
          confirmed: true,
        });
      }

      return NextResponse.json({
        status: "submitted",
        detected: true,
        transactionHash: result.transaction.hash,
        confirmed: false,
        message: "Payment detected, waiting for blockchain confirmation...",
      });
    }

    // No payment found yet
    return NextResponse.json({
      status: "pending",
      detected: false,
    });
  } catch (error) {
    console.error("[check-payment] Error:", error);
    return NextResponse.json(
      { error: "Failed to check payment" },
      { status: 500 }
    );
  }
}

/**
 * Auto-verify a confirmed payment
 * Similar to admin verification but triggered automatically
 */
async function autoVerifyPayment(cryptoPaymentId: string, _txHash: string) {
  const now = new Date().toISOString();

  // Get payment details
  const cryptoPayment = await db.query.cryptoPayments.findFirst({
    where: eq(cryptoPayments.id, cryptoPaymentId),
  });

  if (!cryptoPayment) return;

  // Update crypto payment
  await db
    .update(cryptoPayments)
    .set({
      status: "verified",
      verifiedAt: now,
      adminNotes: "Auto-verified via blockchain confirmation",
      updatedAt: now,
    })
    .where(eq(cryptoPayments.id, cryptoPaymentId));

  // Update payment session
  await db
    .update(paymentSessions)
    .set({
      status: "completed",
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(paymentSessions.id, cryptoPayment.paymentSessionId));

  // Get session to check for invoice
  const session = await db.query.paymentSessions.findFirst({
    where: eq(paymentSessions.id, cryptoPayment.paymentSessionId),
  });

  // If this is for a subscription invoice, activate the subscription
  if (session?.invoiceId) {
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, session.invoiceId),
    });

    if (invoice) {
      // Update invoice
      await db
        .update(invoices)
        .set({
          status: "paid",
          paidAt: now,
          paidAmount: invoice.total,
          updatedAt: now,
        })
        .where(eq(invoices.id, invoice.id));

      // Update tenant subscription
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, session.tenantId),
      });

      if (tenant) {
        // Subscription stacking: extend from current end date if applicable
        const currentEnd = tenant.subscriptionEndsAt
          ? new Date(tenant.subscriptionEndsAt)
          : new Date();
        const nowDate = new Date();

        const isAlreadyProWithTimeRemaining =
          tenant.subscriptionPlan === "pro" && currentEnd > nowDate;

        const extendFrom = isAlreadyProWithTimeRemaining ? currentEnd : nowDate;
        const periodEnd = new Date(extendFrom);

        // Check billing interval from invoice notes
        const isYearly = invoice.notes?.toLowerCase().includes("yearly");
        if (isYearly) {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
          periodEnd.setMonth(periodEnd.getMonth() + 1);
        }

        await db
          .update(tenants)
          .set({
            subscriptionPlan: "pro",
            subscriptionStatus: "active",
            ...(!isAlreadyProWithTimeRemaining && {
              subscriptionStartedAt: now,
            }),
            subscriptionEndsAt: periodEnd.toISOString(),
            billingInterval: isYearly ? "yearly" : "monthly",
            updatedAt: now,
          })
          .where(eq(tenants.id, tenant.id));

        // Update billing transaction
        await db
          .update(billingTransactions)
          .set({
            status: "completed",
            updatedAt: now,
          })
          .where(eq(billingTransactions.invoiceId, invoice.id));
      }
    }
  }
}
