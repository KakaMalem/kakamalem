/**
 * Payout rules, kept out of the server-action file so client components can
 * read them (a "use server" module may only export async functions).
 */

/**
 * Smallest withdrawal, in AFN. Transfers are not free to reconcile and a
 * ten-Afghani payout costs more in attention than it moves.
 */
export const MIN_PAYOUT_AFN = 100;

/**
 * HesabPay account numbers are digit strings. Kept deliberately loose: the
 * authoritative check is HesabPay rejecting the transfer, and a regex that is
 * too strict would lock out a valid account we have not seen.
 */
export const HESABPAY_ACCOUNT_PATTERN = /^[0-9]{6,20}$/;

export function isValidHesabPayAccount(value: string | null | undefined) {
  return HESABPAY_ACCOUNT_PATTERN.test((value || "").trim());
}
