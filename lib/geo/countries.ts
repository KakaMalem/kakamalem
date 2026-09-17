/**
 * Countries: names, map positions, and the checkout picker list.
 *
 * Two jobs live here:
 *
 * 1. Turning an ISO 3166-1 alpha-2 code into something a person can read,
 *    wherever an address or a buyer's country is displayed.
 * 2. Placing a country on a map. `lat` / `lng` are approximate centroids, which
 *    is the right precision for "which countries do our buyers order from".
 *    They are not accurate enough to navigate to and are never used for
 *    delivery.
 */

export type CountryInfo = {
  name: string;
  /** Approximate centroid, for plotting a country on a map. */
  lat: number;
  lng: number;
};

export const COUNTRY_INFO: Record<string, CountryInfo> = {
  AF: { name: "Afghanistan", lat: 33.94, lng: 67.71 },
  AL: { name: "Albania", lat: 41.15, lng: 20.17 },
  DZ: { name: "Algeria", lat: 28.03, lng: 1.66 },
  AD: { name: "Andorra", lat: 42.51, lng: 1.52 },
  AO: { name: "Angola", lat: -11.2, lng: 17.87 },
  AR: { name: "Argentina", lat: -38.42, lng: -63.62 },
  AM: { name: "Armenia", lat: 40.07, lng: 45.04 },
  AU: { name: "Australia", lat: -25.27, lng: 133.78 },
  AT: { name: "Austria", lat: 47.52, lng: 14.55 },
  AZ: { name: "Azerbaijan", lat: 40.14, lng: 47.58 },
  BH: { name: "Bahrain", lat: 26.07, lng: 50.56 },
  BD: { name: "Bangladesh", lat: 23.68, lng: 90.36 },
  BY: { name: "Belarus", lat: 53.71, lng: 27.95 },
  BE: { name: "Belgium", lat: 50.5, lng: 4.47 },
  BZ: { name: "Belize", lat: 17.19, lng: -88.5 },
  BJ: { name: "Benin", lat: 9.31, lng: 2.32 },
  BT: { name: "Bhutan", lat: 27.51, lng: 90.43 },
  BO: { name: "Bolivia", lat: -16.29, lng: -63.59 },
  BA: { name: "Bosnia and Herzegovina", lat: 43.92, lng: 17.68 },
  BW: { name: "Botswana", lat: -22.33, lng: 24.68 },
  BR: { name: "Brazil", lat: -14.24, lng: -51.93 },
  BN: { name: "Brunei", lat: 4.54, lng: 114.73 },
  BG: { name: "Bulgaria", lat: 42.73, lng: 25.49 },
  BF: { name: "Burkina Faso", lat: 12.24, lng: -1.56 },
  BI: { name: "Burundi", lat: -3.37, lng: 29.92 },
  KH: { name: "Cambodia", lat: 12.57, lng: 104.99 },
  CM: { name: "Cameroon", lat: 7.37, lng: 12.35 },
  CA: { name: "Canada", lat: 56.13, lng: -106.35 },
  CV: { name: "Cape Verde", lat: 16.0, lng: -24.01 },
  CF: { name: "Central African Republic", lat: 6.61, lng: 20.94 },
  TD: { name: "Chad", lat: 15.45, lng: 18.73 },
  CL: { name: "Chile", lat: -35.68, lng: -71.54 },
  CN: { name: "China", lat: 35.86, lng: 104.2 },
  CO: { name: "Colombia", lat: 4.57, lng: -74.3 },
  CG: { name: "Congo", lat: -0.23, lng: 15.83 },
  CD: { name: "DR Congo", lat: -4.04, lng: 21.76 },
  CR: { name: "Costa Rica", lat: 9.75, lng: -83.75 },
  CI: { name: "Cote d Ivoire", lat: 7.54, lng: -5.55 },
  HR: { name: "Croatia", lat: 45.1, lng: 15.2 },
  CU: { name: "Cuba", lat: 21.52, lng: -77.78 },
  CY: { name: "Cyprus", lat: 35.13, lng: 33.43 },
  CZ: { name: "Czechia", lat: 49.82, lng: 15.47 },
  DK: { name: "Denmark", lat: 56.26, lng: 9.5 },
  DJ: { name: "Djibouti", lat: 11.83, lng: 42.59 },
  DO: { name: "Dominican Republic", lat: 18.74, lng: -70.16 },
  EC: { name: "Ecuador", lat: -1.83, lng: -78.18 },
  EG: { name: "Egypt", lat: 26.82, lng: 30.8 },
  SV: { name: "El Salvador", lat: 13.79, lng: -88.9 },
  ER: { name: "Eritrea", lat: 15.18, lng: 39.78 },
  EE: { name: "Estonia", lat: 58.6, lng: 25.01 },
  SZ: { name: "Eswatini", lat: -26.52, lng: 31.47 },
  ET: { name: "Ethiopia", lat: 9.15, lng: 40.49 },
  FJ: { name: "Fiji", lat: -17.71, lng: 178.07 },
  FI: { name: "Finland", lat: 61.92, lng: 25.75 },
  FR: { name: "France", lat: 46.23, lng: 2.21 },
  GA: { name: "Gabon", lat: -0.8, lng: 11.61 },
  GM: { name: "Gambia", lat: 13.44, lng: -15.31 },
  GE: { name: "Georgia", lat: 42.32, lng: 43.36 },
  DE: { name: "Germany", lat: 51.17, lng: 10.45 },
  GH: { name: "Ghana", lat: 7.95, lng: -1.02 },
  GR: { name: "Greece", lat: 39.07, lng: 21.82 },
  GT: { name: "Guatemala", lat: 15.78, lng: -90.23 },
  GN: { name: "Guinea", lat: 9.95, lng: -9.7 },
  GY: { name: "Guyana", lat: 4.86, lng: -58.93 },
  HT: { name: "Haiti", lat: 18.97, lng: -72.29 },
  HN: { name: "Honduras", lat: 15.2, lng: -86.24 },
  HK: { name: "Hong Kong", lat: 22.32, lng: 114.17 },
  HU: { name: "Hungary", lat: 47.16, lng: 19.5 },
  IS: { name: "Iceland", lat: 64.96, lng: -19.02 },
  IN: { name: "India", lat: 20.59, lng: 78.96 },
  ID: { name: "Indonesia", lat: -0.79, lng: 113.92 },
  IR: { name: "Iran", lat: 32.43, lng: 53.69 },
  IQ: { name: "Iraq", lat: 33.22, lng: 43.68 },
  IE: { name: "Ireland", lat: 53.41, lng: -8.24 },
  IL: { name: "Israel", lat: 31.05, lng: 34.85 },
  IT: { name: "Italy", lat: 41.87, lng: 12.57 },
  JM: { name: "Jamaica", lat: 18.11, lng: -77.3 },
  JP: { name: "Japan", lat: 36.2, lng: 138.25 },
  JO: { name: "Jordan", lat: 30.59, lng: 36.24 },
  KZ: { name: "Kazakhstan", lat: 48.02, lng: 66.92 },
  KE: { name: "Kenya", lat: -0.02, lng: 37.91 },
  KW: { name: "Kuwait", lat: 29.31, lng: 47.48 },
  KG: { name: "Kyrgyzstan", lat: 41.2, lng: 74.77 },
  LA: { name: "Laos", lat: 19.86, lng: 102.5 },
  LV: { name: "Latvia", lat: 56.88, lng: 24.6 },
  LB: { name: "Lebanon", lat: 33.85, lng: 35.86 },
  LS: { name: "Lesotho", lat: -29.61, lng: 28.23 },
  LR: { name: "Liberia", lat: 6.43, lng: -9.43 },
  LY: { name: "Libya", lat: 26.34, lng: 17.23 },
  LI: { name: "Liechtenstein", lat: 47.17, lng: 9.56 },
  LT: { name: "Lithuania", lat: 55.17, lng: 23.88 },
  LU: { name: "Luxembourg", lat: 49.82, lng: 6.13 },
  MO: { name: "Macao", lat: 22.2, lng: 113.54 },
  MG: { name: "Madagascar", lat: -18.77, lng: 46.87 },
  MW: { name: "Malawi", lat: -13.25, lng: 34.3 },
  MY: { name: "Malaysia", lat: 4.21, lng: 101.98 },
  MV: { name: "Maldives", lat: 3.2, lng: 73.22 },
  ML: { name: "Mali", lat: 17.57, lng: -4.0 },
  MT: { name: "Malta", lat: 35.94, lng: 14.38 },
  MR: { name: "Mauritania", lat: 21.01, lng: -10.94 },
  MU: { name: "Mauritius", lat: -20.35, lng: 57.55 },
  MX: { name: "Mexico", lat: 23.63, lng: -102.55 },
  MD: { name: "Moldova", lat: 47.41, lng: 28.37 },
  MC: { name: "Monaco", lat: 43.75, lng: 7.41 },
  MN: { name: "Mongolia", lat: 46.86, lng: 103.85 },
  ME: { name: "Montenegro", lat: 42.71, lng: 19.37 },
  MA: { name: "Morocco", lat: 31.79, lng: -7.09 },
  MZ: { name: "Mozambique", lat: -18.67, lng: 35.53 },
  MM: { name: "Myanmar", lat: 21.91, lng: 95.96 },
  NA: { name: "Namibia", lat: -22.96, lng: 18.49 },
  NP: { name: "Nepal", lat: 28.39, lng: 84.12 },
  NL: { name: "Netherlands", lat: 52.13, lng: 5.29 },
  NZ: { name: "New Zealand", lat: -40.9, lng: 174.89 },
  NI: { name: "Nicaragua", lat: 12.87, lng: -85.21 },
  NE: { name: "Niger", lat: 17.61, lng: 8.08 },
  NG: { name: "Nigeria", lat: 9.08, lng: 8.68 },
  MK: { name: "North Macedonia", lat: 41.61, lng: 21.75 },
  NO: { name: "Norway", lat: 60.47, lng: 8.47 },
  OM: { name: "Oman", lat: 21.51, lng: 55.92 },
  PK: { name: "Pakistan", lat: 30.38, lng: 69.35 },
  PS: { name: "Palestine", lat: 31.95, lng: 35.23 },
  PA: { name: "Panama", lat: 8.54, lng: -80.78 },
  PG: { name: "Papua New Guinea", lat: -6.31, lng: 143.96 },
  PY: { name: "Paraguay", lat: -23.44, lng: -58.44 },
  PE: { name: "Peru", lat: -9.19, lng: -75.02 },
  PH: { name: "Philippines", lat: 12.88, lng: 121.77 },
  PL: { name: "Poland", lat: 51.92, lng: 19.15 },
  PT: { name: "Portugal", lat: 39.4, lng: -8.22 },
  PR: { name: "Puerto Rico", lat: 18.22, lng: -66.59 },
  QA: { name: "Qatar", lat: 25.35, lng: 51.18 },
  RO: { name: "Romania", lat: 45.94, lng: 24.97 },
  RU: { name: "Russia", lat: 61.52, lng: 105.32 },
  RW: { name: "Rwanda", lat: -1.94, lng: 29.87 },
  SA: { name: "Saudi Arabia", lat: 23.89, lng: 45.08 },
  SN: { name: "Senegal", lat: 14.5, lng: -14.45 },
  RS: { name: "Serbia", lat: 44.02, lng: 21.01 },
  SG: { name: "Singapore", lat: 1.35, lng: 103.82 },
  SK: { name: "Slovakia", lat: 48.67, lng: 19.7 },
  SI: { name: "Slovenia", lat: 46.15, lng: 14.99 },
  SO: { name: "Somalia", lat: 5.15, lng: 46.2 },
  ZA: { name: "South Africa", lat: -30.56, lng: 22.94 },
  KR: { name: "South Korea", lat: 35.91, lng: 127.77 },
  SS: { name: "South Sudan", lat: 6.88, lng: 31.31 },
  ES: { name: "Spain", lat: 40.46, lng: -3.75 },
  LK: { name: "Sri Lanka", lat: 7.87, lng: 80.77 },
  SD: { name: "Sudan", lat: 12.86, lng: 30.22 },
  SR: { name: "Suriname", lat: 3.92, lng: -56.03 },
  SE: { name: "Sweden", lat: 60.13, lng: 18.64 },
  CH: { name: "Switzerland", lat: 46.82, lng: 8.23 },
  SY: { name: "Syria", lat: 34.8, lng: 39.0 },
  TW: { name: "Taiwan", lat: 23.7, lng: 120.96 },
  TJ: { name: "Tajikistan", lat: 38.86, lng: 71.28 },
  TZ: { name: "Tanzania", lat: -6.37, lng: 34.89 },
  TH: { name: "Thailand", lat: 15.87, lng: 100.99 },
  TG: { name: "Togo", lat: 8.62, lng: 0.82 },
  TT: { name: "Trinidad and Tobago", lat: 10.69, lng: -61.22 },
  TN: { name: "Tunisia", lat: 33.89, lng: 9.54 },
  TR: { name: "Turkey", lat: 38.96, lng: 35.24 },
  TM: { name: "Turkmenistan", lat: 38.97, lng: 59.56 },
  UG: { name: "Uganda", lat: 1.37, lng: 32.29 },
  UA: { name: "Ukraine", lat: 48.38, lng: 31.17 },
  AE: { name: "United Arab Emirates", lat: 23.42, lng: 53.85 },
  GB: { name: "United Kingdom", lat: 55.38, lng: -3.44 },
  US: { name: "United States", lat: 37.09, lng: -95.71 },
  UY: { name: "Uruguay", lat: -32.52, lng: -55.77 },
  UZ: { name: "Uzbekistan", lat: 41.38, lng: 64.59 },
  VE: { name: "Venezuela", lat: 6.42, lng: -66.59 },
  VN: { name: "Vietnam", lat: 14.06, lng: 108.28 },
  YE: { name: "Yemen", lat: 15.55, lng: 48.52 },
  ZM: { name: "Zambia", lat: -13.13, lng: 27.85 },
  ZW: { name: "Zimbabwe", lat: -19.02, lng: 29.15 },
};

export type Country = {
  code: string;
  name: string;
};

/**
 * Codes offered in the checkout address picker. Deliberately shorter than the
 * full list above: these are the places this platform's stores ship from and
 * to, and a 200-entry dropdown helps nobody.
 */
const PICKER_CODES = [
  "AF",
  "AE",
  "US",
  "GB",
  "CA",
  "DE",
  "FR",
  "AU",
  "IN",
  "PK",
  "IR",
  "TR",
  "SA",
  "QA",
  "KW",
  "OM",
  "BH",
  "JP",
  "CN",
  "KR",
  "NL",
  "SE",
  "NO",
  "DK",
  "IT",
  "ES",
  "BR",
  "MX",
  "EG",
  "NG",
  "ZA",
  "MY",
  "SG",
  "TH",
  "ID",
  "PH",
  "NZ",
  "TJ",
  "UZ",
  "TM",
];

export const COUNTRIES: Country[] = PICKER_CODES.map((code) => ({
  code,
  name: COUNTRY_INFO[code]?.name ?? code,
})).sort((a, b) => a.name.localeCompare(b.name));

function normalizeCode(code: string | null | undefined): string | null {
  const normalized = code?.trim().toUpperCase();
  return normalized ? normalized : null;
}

/**
 * Human-readable country name for a code. Unknown codes are returned as-is so
 * an address entered before a country joined the list still renders something.
 */
export function getCountryName(code: string | null | undefined): string | null {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  return COUNTRY_INFO[normalized]?.name ?? normalized;
}

/**
 * Approximate map position for a country, or null when the code is unknown.
 */
export function getCountryCentroid(
  code: string | null | undefined
): { lat: number; lng: number } | null {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const info = COUNTRY_INFO[normalized];
  return info ? { lat: info.lat, lng: info.lng } : null;
}
