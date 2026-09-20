/**
 * The HesabPay account a seller is paid into.
 *
 * A HesabPay account is an Afghan mobile number, and the two ends of this want
 * it written differently:
 *
 * - **We** store and display it as E.164 (`+93776022969`), because that is
 *   unambiguous and it is what the phone input in the rest of the dashboard
 *   produces.
 * - **HesabPay** wants the national number with no country code and no leading
 *   zero (`776022969`), which is the shape its own examples use.
 *
 * Getting that wrong is expensive: a transfer to a number that is one digit
 * short is rejected, and a transfer to a *valid but wrong* number cannot be
 * undone. So conversion happens in exactly one place, here.
 */

import {
  isValidPhoneNumber,
  parsePhoneNumber,
  type CountryCode,
} from "libphonenumber-js";

/** HesabPay is Afghanistan-only, so accounts are always Afghan numbers. */
export const HESABPAY_COUNTRY: CountryCode = "AF";

/** Afghan mobile numbers are nine digits after the country code. */
export const HESABPAY_ACCOUNT_DIGITS = 9;

export type PayoutAccountError =
  | "empty"
  | "invalid"
  | "wrong_country"
  | "wrong_length"
  | "not_mobile";

export const PAYOUT_ACCOUNT_MESSAGES: Record<PayoutAccountError, string> = {
  empty: "Enter the HesabPay number your money should be sent to",
  invalid: "That is not a valid phone number",
  wrong_country: "HesabPay accounts are Afghan numbers, starting +93",
  wrong_length: `An Afghan HesabPay number has ${HESABPAY_ACCOUNT_DIGITS} digits after +93`,
  not_mobile: "HesabPay accounts are mobile numbers, not landlines",
};

/**
 * Turn whatever digits a person wrote into an E.164 candidate.
 *
 * People write their own number every way there is: with the country code, with
 * the international access prefix, with the local trunk zero, or bare. All of
 * those mean the same number, and an account saved before this field became a
 * phone input can be in any of them.
 */
function toCandidate(raw: string): string {
  if (raw.startsWith("+")) return raw;

  let digits = raw.replace(/\D/g, "");

  // "0093..." — international access prefix.
  if (digits.startsWith("00")) digits = digits.slice(2);

  // "93776022969" — already carries the country code. An Afghan national
  // number is exactly 9 digits, so 11 starting with 93 is unambiguous.
  if (digits.length === HESABPAY_ACCOUNT_DIGITS + 2 && digits.startsWith("93")) {
    return `+${digits}`;
  }

  // "0776022969" — the local trunk zero.
  return `+93${digits.replace(/^0+/, "")}`;
}

export type NormalizedPayoutAccount = {
  /** Canonical form we store and display, e.g. "+93776022969". */
  e164: string;
  /** What HesabPay's API expects, e.g. "776022969". */
  hesabpay: string;
};

/**
 * Validate and canonicalise whatever the seller typed.
 *
 * Accepts an E.164 string from the phone input, and also tolerates bare digits
 * so a value saved before this field became a phone input can still be read.
 */
export function normalizePayoutAccount(
  input: string | null | undefined
): { ok: true; account: NormalizedPayoutAccount } | {
  ok: false;
  error: PayoutAccountError;
} {
  const raw = (input || "").trim();
  if (!raw) return { ok: false, error: "empty" };

  const candidate = toCandidate(raw);

  if (!isValidPhoneNumber(candidate)) {
    // Say which way it is wrong, so the seller is not sent hunting.
    if (!candidate.startsWith("+93")) {
      return { ok: false, error: "wrong_country" };
    }
    const nationalDigits = candidate.slice(3).replace(/\D/g, "");
    if (
      nationalDigits.length > 0 &&
      nationalDigits.length !== HESABPAY_ACCOUNT_DIGITS
    ) {
      return { ok: false, error: "wrong_length" };
    }
    return { ok: false, error: "invalid" };
  }

  let parsed;
  try {
    parsed = parsePhoneNumber(candidate);
  } catch {
    return { ok: false, error: "invalid" };
  }

  if (!parsed) return { ok: false, error: "invalid" };
  if (parsed.country !== HESABPAY_COUNTRY) {
    return { ok: false, error: "wrong_country" };
  }

  const national = parsed.nationalNumber.toString();
  if (national.length !== HESABPAY_ACCOUNT_DIGITS) {
    return { ok: false, error: "wrong_length" };
  }

  // A HesabPay account is a mobile wallet, so a landline is a typo that would
  // otherwise only be discovered by an irreversible transfer. The bundled
  // metadata cannot always tell, so only reject a definite non-mobile.
  const type = parsed.getType?.();
  if (type && type !== "MOBILE" && type !== "FIXED_LINE_OR_MOBILE") {
    return { ok: false, error: "not_mobile" };
  }

  return {
    ok: true,
    account: { e164: parsed.number, hesabpay: national },
  };
}

/** True when this value can be paid out to. */
export function isValidPayoutAccount(
  input: string | null | undefined
): boolean {
  return normalizePayoutAccount(input).ok;
}

/**
 * The stored value as E.164, for seeding the phone input. Returns an empty
 * string when there is nothing usable, so the field simply starts blank.
 */
export function toE164ForDisplay(input: string | null | undefined): string {
  const result = normalizePayoutAccount(input);
  return result.ok ? result.account.e164 : "";
}

/** Spaced for reading, e.g. "+93 77 602 2969". */
export function formatPayoutAccount(input: string | null | undefined): string {
  const result = normalizePayoutAccount(input);
  if (!result.ok) return (input || "").trim();
  try {
    return parsePhoneNumber(result.account.e164)?.formatInternational() ?? result.account.e164;
  } catch {
    return result.account.e164;
  }
}
