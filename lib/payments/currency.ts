/**
 * HesabPay currency rules.
 *
 * HesabPay's create-session API takes a list of items with a bare `price`
 * number and has NO currency field — every amount it receives is treated as
 * Afghan Afghani (AFN), and HesabPay does not convert anything on its side.
 * A store whose base currency is not AFN therefore has to convert the order
 * total itself before handing it to HesabPay.
 *
 * The conversion rate is set per store (`tenants.afnExchangeRate`) using the
 * convention "1 unit of the store's currency = X AFN". It is the same
 * convention as `orders.exchangeRateUsed`, so a rate locked onto an order can
 * be divided back out to recover the amount in the store's currency.
 *
 * This module is intentionally dependency-free (no database, no server-only
 * imports) so both server actions and client components can share the maths
 * and show the customer exactly what they are about to be charged.
 */

/** The only currency HesabPay settles in. */
export const HESABPAY_CURRENCY = "AFN";

/** Upper bound for a sane store-currency-to-AFN rate. */
export const MAX_AFN_EXCHANGE_RATE = 1_000_000;

/**
 * Convert an amount in the store's currency into whole AFN.
 *
 * AFN is displayed and charged without decimals, so the result is rounded to
 * the nearest whole unit — matching what the customer is shown.
 */
export function toAfnAmount(amount: number, rate: number): number {
  return Math.round(amount * rate);
}

/**
 * Convert an AFN amount back into the store's currency using a locked rate.
 * Used when reconciling a gateway payment against an order total.
 */
export function fromAfnAmount(afnAmount: number, rate: number): number {
  return afnAmount / rate;
}

/** Parse a rate coming from the database (decimal columns arrive as strings). */
export function parseExchangeRate(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export type HesabPayChargeInput = {
  /** The store's base currency (`tenants.currency`). */
  storeCurrency: string | null | undefined;
  /** The store's configured rate, or a rate already locked onto the order. */
  exchangeRate: string | number | null | undefined;
  /** Amount due, in the store's base currency. */
  amount: number;
};

export type HesabPayCharge =
  | {
      ok: true;
      /** Amount to send to HesabPay, always whole AFN. */
      afnAmount: number;
      /** Rate applied, or null when the store already prices in AFN. */
      rate: number | null;
      /** True when the store's currency differs from AFN. */
      converted: boolean;
    }
  | {
      ok: false;
      reason: "missing_rate" | "invalid_amount";
      message: string;
    };

/**
 * Work out what HesabPay should charge for an amount in a store's currency.
 */
export function resolveHesabPayCharge({
  storeCurrency,
  exchangeRate,
  amount,
}: HesabPayChargeInput): HesabPayCharge {
  const currency = (storeCurrency || HESABPAY_CURRENCY).toUpperCase();

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      reason: "invalid_amount",
      message: "This order has nothing left to pay.",
    };
  }

  if (currency === HESABPAY_CURRENCY) {
    return {
      ok: true,
      afnAmount: Math.round(amount),
      rate: null,
      converted: false,
    };
  }

  const rate = parseExchangeRate(exchangeRate);
  if (!rate) {
    return {
      ok: false,
      reason: "missing_rate",
      message:
        "This store has not set an Afghani exchange rate yet, so card payment is unavailable. Please choose another payment method.",
    };
  }

  const afnAmount = toAfnAmount(amount, rate);
  if (afnAmount < 1) {
    return {
      ok: false,
      reason: "invalid_amount",
      message: "This amount is too small to be charged in Afghani.",
    };
  }

  return { ok: true, afnAmount, rate, converted: true };
}

/**
 * Whether HesabPay can be offered at all for a store.
 */
export function canStoreUseHesabPay(
  storeCurrency: string | null | undefined,
  exchangeRate: string | number | null | undefined
): boolean {
  const currency = (storeCurrency || HESABPAY_CURRENCY).toUpperCase();
  if (currency === HESABPAY_CURRENCY) return true;
  return parseExchangeRate(exchangeRate) !== null;
}
