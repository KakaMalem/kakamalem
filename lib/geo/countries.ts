/**
 * Country list for address entry and display.
 *
 * Shared so the checkout form and every place that renders a saved address
 * agree on the code-to-name mapping. Codes are ISO 3166-1 alpha-2, matching
 * `Address.country`.
 */

export type Country = {
  code: string;
  name: string;
};

export const COUNTRIES: Country[] = [
  { code: "AF", name: "Afghanistan" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "AU", name: "Australia" },
  { code: "IN", name: "India" },
  { code: "PK", name: "Pakistan" },
  { code: "IR", name: "Iran" },
  { code: "TR", name: "Turkey" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "QA", name: "Qatar" },
  { code: "KW", name: "Kuwait" },
  { code: "OM", name: "Oman" },
  { code: "BH", name: "Bahrain" },
  { code: "JP", name: "Japan" },
  { code: "CN", name: "China" },
  { code: "KR", name: "South Korea" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "EG", name: "Egypt" },
  { code: "NG", name: "Nigeria" },
  { code: "ZA", name: "South Africa" },
  { code: "MY", name: "Malaysia" },
  { code: "SG", name: "Singapore" },
  { code: "TH", name: "Thailand" },
  { code: "ID", name: "Indonesia" },
  { code: "PH", name: "Philippines" },
  { code: "NZ", name: "New Zealand" },
  { code: "TJ", name: "Tajikistan" },
  { code: "UZ", name: "Uzbekistan" },
  { code: "TM", name: "Turkmenistan" },
].sort((a, b) =>
  a.name.localeCompare(b.name)
);

const COUNTRY_NAMES_BY_CODE = new Map(
  COUNTRIES.map((country) => [country.code, country.name])
);

/**
 * Human-readable country name for a code. Unknown codes are returned as-is so
 * an address entered before a country joined the list still renders something.
 */
export function getCountryName(
  code: string | null | undefined
): string | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  return COUNTRY_NAMES_BY_CODE.get(normalized) ?? normalized;
}
