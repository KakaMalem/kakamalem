/**
 * Currency helpers — AFN-only stubs.
 *
 * The platform is single-currency (AFN). These stubs exist so that the
 * Amazon / AliExpress importers (which fetch products priced in foreign
 * currencies) keep compiling. They DO NOT convert: imported prices are
 * stored as-is and the seller adjusts after import.
 */

export type ExchangeRates = Record<string, number>;

export async function getExchangeRates(): Promise<ExchangeRates> {
  return {};
}

/**
 * No-op: returns the input amount unchanged.
 * Sellers are expected to manually set the final AFN price after import.
 */
export async function convertToAFN(
  amount: number,
  _sourceCurrency: string,
  _rates?: ExchangeRates
): Promise<number> {
  return amount;
}
