/**
 * Payout rules, kept out of the server-action file so client components can
 * read them (a "use server" module may only export async functions).
 *
 * Account number validation lives in `./account`, because a HesabPay account is
 * an Afghan phone number rather than a free-form string.
 */

/**
 * Smallest withdrawal, in AFN. Transfers are not free to reconcile and a
 * ten-Afghani payout costs more in attention than it moves.
 */
export const MIN_PAYOUT_AFN = 100;
