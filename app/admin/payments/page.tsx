import { requirePlatformAdmin } from "@/lib/auth/server";
import { getPendingCryptoPayments } from "@/lib/actions/crypto-payments";
import { CryptoVerificationsClient } from "./crypto-verifications-client";

/**
 * Admin Crypto Payments Verification Page
 *
 * Platform admins can verify crypto (USDT) payments here.
 */
export default async function AdminPaymentsPage() {
  // Auth check - platform admin only
  await requirePlatformAdmin();

  // Get pending crypto payments
  const result = await getPendingCryptoPayments({ limit: 100 });

  if (!result.success) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Crypto Payment Verification</h1>
        <p className="mt-4 text-destructive">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Crypto Payment Verification
        </h1>
        <p className="text-muted-foreground">
          Verify USDT payments submitted by customers
        </p>
      </div>

      <CryptoVerificationsClient payments={result.data || []} />
    </div>
  );
}
