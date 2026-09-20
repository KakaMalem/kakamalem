/**
 * What kind of thing went wrong with a payout.
 *
 * "It failed" is not enough when money is involved, because the right response
 * differs completely by cause. A seller who typed a bad number should fix the
 * field. A seller whose transfer HesabPay rejected should read HesabPay's
 * reason. A seller whose request never got an answer must NOT simply press the
 * button again, because the money may already have moved.
 *
 * So every failure carries a kind, and the interface reacts to it.
 */

export type PayoutErrorKind =
  /** The seller can fix this by changing what they entered. */
  | "validation"
  /** They are not allowed to do this. */
  | "permission"
  /** Not enough available balance. */
  | "balance"
  /** HesabPay answered and refused. The money did not move. */
  | "gateway"
  /** The platform is misconfigured. Nothing the seller can do. */
  | "configuration"
  /**
   * We never got a clear answer. The transfer may or may not have happened,
   * so the funds stay reserved and a human has to check HesabPay.
   */
  | "unknown_outcome"
  /** A bug on our side. */
  | "unexpected";

export type PayoutError = {
  kind: PayoutErrorKind;
  /** Shown to the seller. Always a plain string, never a raw gateway object. */
  message: string;
  /** Which form field is at fault, for validation errors. */
  field?: "accountNumber" | "accountName" | "amount";
};

export function payoutError(
  kind: PayoutErrorKind,
  message: string,
  field?: PayoutError["field"]
): PayoutError {
  return { kind, message, field };
}

/**
 * Whether pressing the button again is safe.
 *
 * False only for `unknown_outcome`: retrying there risks paying twice.
 */
export function isSafeToRetry(kind: PayoutErrorKind): boolean {
  return kind !== "unknown_outcome";
}

/** Failures worth alerting on, as opposed to ordinary user mistakes. */
export function isOperationalError(kind: PayoutErrorKind): boolean {
  return (
    kind === "configuration" ||
    kind === "unexpected" ||
    kind === "unknown_outcome"
  );
}
