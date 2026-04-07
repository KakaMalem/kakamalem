/**
 * Country to Currency Mapping
 *
 * Maps ISO 3166-1 alpha-2 country codes to ISO 4217 currency codes.
 * Used for automatic currency detection based on customer's IP location.
 */

// Country code to currency code mapping
export const countryCurrencyMap: Record<string, string> = {
  // Afghanistan and neighboring countries
  AF: "AFN", // Afghanistan - Afghan Afghani
  PK: "PKR", // Pakistan - Pakistani Rupee
  IR: "IRR", // Iran - Iranian Rial
  TJ: "TJS", // Tajikistan - Tajikistani Somoni
  UZ: "UZS", // Uzbekistan - Uzbekistani Som
  TM: "TMT", // Turkmenistan - Turkmenistani Manat

  // Middle East (key diaspora regions)
  AE: "AED", // UAE - Emirati Dirham
  SA: "SAR", // Saudi Arabia - Saudi Riyal
  QA: "QAR", // Qatar - Qatari Riyal
  KW: "KWD", // Kuwait - Kuwaiti Dinar
  BH: "BHD", // Bahrain - Bahraini Dinar
  OM: "OMR", // Oman - Omani Rial
  IQ: "IQD", // Iraq - Iraqi Dinar
  JO: "JOD", // Jordan - Jordanian Dinar
  LB: "LBP", // Lebanon - Lebanese Pound
  TR: "TRY", // Turkey - Turkish Lira

  // Europe (major diaspora regions)
  DE: "EUR", // Germany - Euro
  FR: "EUR", // France - Euro
  NL: "EUR", // Netherlands - Euro
  BE: "EUR", // Belgium - Euro
  AT: "EUR", // Austria - Euro
  IT: "EUR", // Italy - Euro
  ES: "EUR", // Spain - Euro
  PT: "EUR", // Portugal - Euro
  GR: "EUR", // Greece - Euro
  IE: "EUR", // Ireland - Euro
  FI: "EUR", // Finland - Euro

  GB: "GBP", // United Kingdom - British Pound
  SE: "SEK", // Sweden - Swedish Krona
  NO: "NOK", // Norway - Norwegian Krone
  DK: "DKK", // Denmark - Danish Krone
  CH: "CHF", // Switzerland - Swiss Franc
  PL: "PLN", // Poland - Polish Zloty

  // North America
  US: "USD", // United States - US Dollar
  CA: "CAD", // Canada - Canadian Dollar
  MX: "MXN", // Mexico - Mexican Peso

  // Asia Pacific
  IN: "INR", // India - Indian Rupee
  CN: "CNY", // China - Chinese Yuan
  JP: "JPY", // Japan - Japanese Yen
  KR: "KRW", // South Korea - South Korean Won
  AU: "AUD", // Australia - Australian Dollar
  NZ: "NZD", // New Zealand - New Zealand Dollar
  SG: "SGD", // Singapore - Singapore Dollar
  MY: "MYR", // Malaysia - Malaysian Ringgit
  TH: "THB", // Thailand - Thai Baht
  ID: "IDR", // Indonesia - Indonesian Rupiah
  PH: "PHP", // Philippines - Philippine Peso
  VN: "VND", // Vietnam - Vietnamese Dong

  // Africa
  ZA: "ZAR", // South Africa - South African Rand
  EG: "EGP", // Egypt - Egyptian Pound
  NG: "NGN", // Nigeria - Nigerian Naira
  KE: "KES", // Kenya - Kenyan Shilling

  // South America
  BR: "BRL", // Brazil - Brazilian Real
  AR: "ARS", // Argentina - Argentine Peso
  CL: "CLP", // Chile - Chilean Peso
  CO: "COP", // Colombia - Colombian Peso
};

/**
 * Currencies supported for display and payment on the platform.
 * These currencies have good exchange rate availability and are commonly used
 * by the Afghan diaspora and international customers.
 */
export const supportedCurrencies = [
  "USDT", // Tether (platform default for escrow marketplace)
  "AFN", // Afghan Afghani (legacy)
  "USD", // US Dollar (universal)
  "EUR", // Euro (Europe)
  "GBP", // British Pound (UK)
  "AED", // UAE Dirham (Gulf region)
  "SAR", // Saudi Riyal (Gulf region)
  "PKR", // Pakistani Rupee (neighbor)
  "INR", // Indian Rupee (South Asia)
  "TRY", // Turkish Lira (Turkey)
  "CAD", // Canadian Dollar (diaspora)
  "AUD", // Australian Dollar (diaspora)
] as const;

export type SupportedCurrency = (typeof supportedCurrencies)[number];

/**
 * Currency display information
 */
export const currencyInfo: Record<
  SupportedCurrency,
  {
    code: string;
    symbol: string;
    name: string;
    nameFa?: string; // Dari/Persian name
    decimals: number;
  }
> = {
  USDT: {
    code: "USDT",
    symbol: "$",
    name: "Tether USD",
    decimals: 2,
  },
  AFN: {
    code: "AFN",
    symbol: "؋",
    name: "Afghan Afghani",
    nameFa: "افغانی",
    decimals: 0, // AFN typically shown without decimals
  },
  USD: {
    code: "USD",
    symbol: "$",
    name: "US Dollar",
    nameFa: "دالر امریکایی",
    decimals: 2,
  },
  EUR: {
    code: "EUR",
    symbol: "€",
    name: "Euro",
    nameFa: "یورو",
    decimals: 2,
  },
  GBP: {
    code: "GBP",
    symbol: "£",
    name: "British Pound",
    nameFa: "پوند بریتانیا",
    decimals: 2,
  },
  AED: {
    code: "AED",
    symbol: "د.إ",
    name: "UAE Dirham",
    nameFa: "درهم امارات",
    decimals: 2,
  },
  SAR: {
    code: "SAR",
    symbol: "ر.س",
    name: "Saudi Riyal",
    nameFa: "ریال سعودی",
    decimals: 2,
  },
  PKR: {
    code: "PKR",
    symbol: "₨",
    name: "Pakistani Rupee",
    nameFa: "روپیه پاکستان",
    decimals: 0,
  },
  INR: {
    code: "INR",
    symbol: "₹",
    name: "Indian Rupee",
    nameFa: "روپیه هند",
    decimals: 2,
  },
  TRY: {
    code: "TRY",
    symbol: "₺",
    name: "Turkish Lira",
    nameFa: "لیره ترکیه",
    decimals: 2,
  },
  CAD: {
    code: "CAD",
    symbol: "C$",
    name: "Canadian Dollar",
    nameFa: "دالر کانادا",
    decimals: 2,
  },
  AUD: {
    code: "AUD",
    symbol: "A$",
    name: "Australian Dollar",
    nameFa: "دالر استرالیا",
    decimals: 2,
  },
};

/**
 * IANA Timezone to ISO 3166-1 alpha-2 country code mapping.
 * Used for auto-detecting customer location from browser timezone,
 * which is far more reliable than navigator.language for geolocation.
 *
 * Only includes timezones for countries in our countryCurrencyMap.
 */
export const timezoneToCountryMap: Record<string, string> = {
  // Afghanistan
  "Asia/Kabul": "AF",

  // Pakistan
  "Asia/Karachi": "PK",

  // Iran
  "Asia/Tehran": "IR",

  // Tajikistan
  "Asia/Dushanbe": "TJ",

  // Uzbekistan
  "Asia/Tashkent": "UZ",
  "Asia/Samarkand": "UZ",

  // Turkmenistan
  "Asia/Ashgabat": "TM",

  // UAE
  "Asia/Dubai": "AE",

  // Saudi Arabia
  "Asia/Riyadh": "SA",

  // Qatar
  "Asia/Qatar": "QA",

  // Kuwait
  "Asia/Kuwait": "KW",

  // Bahrain
  "Asia/Bahrain": "BH",

  // Oman
  "Asia/Muscat": "OM",

  // Iraq
  "Asia/Baghdad": "IQ",

  // Jordan
  "Asia/Amman": "JO",

  // Lebanon
  "Asia/Beirut": "LB",

  // Turkey
  "Europe/Istanbul": "TR",

  // Germany
  "Europe/Berlin": "DE",

  // France
  "Europe/Paris": "FR",

  // Netherlands
  "Europe/Amsterdam": "NL",

  // Belgium
  "Europe/Brussels": "BE",

  // Austria
  "Europe/Vienna": "AT",

  // Italy
  "Europe/Rome": "IT",

  // Spain
  "Europe/Madrid": "ES",

  // Portugal
  "Europe/Lisbon": "PT",

  // Greece
  "Europe/Athens": "GR",

  // Ireland
  "Europe/Dublin": "IE",

  // Finland
  "Europe/Helsinki": "FI",

  // United Kingdom
  "Europe/London": "GB",

  // Sweden
  "Europe/Stockholm": "SE",

  // Norway
  "Europe/Oslo": "NO",

  // Denmark
  "Europe/Copenhagen": "DK",

  // Switzerland
  "Europe/Zurich": "CH",

  // Poland
  "Europe/Warsaw": "PL",

  // United States
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Phoenix": "US",
  "America/Anchorage": "US",
  "Pacific/Honolulu": "US",
  "America/Detroit": "US",
  "America/Indiana/Indianapolis": "US",
  "America/Boise": "US",

  // Canada
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Edmonton": "CA",
  "America/Winnipeg": "CA",
  "America/Halifax": "CA",
  "America/St_Johns": "CA",

  // Mexico
  "America/Mexico_City": "MX",
  "America/Tijuana": "MX",

  // India
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",

  // China
  "Asia/Shanghai": "CN",

  // Japan
  "Asia/Tokyo": "JP",

  // South Korea
  "Asia/Seoul": "KR",

  // Australia
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU",
  "Australia/Perth": "AU",
  "Australia/Adelaide": "AU",
  "Australia/Hobart": "AU",
  "Australia/Darwin": "AU",

  // New Zealand
  "Pacific/Auckland": "NZ",

  // Singapore
  "Asia/Singapore": "SG",

  // Malaysia
  "Asia/Kuala_Lumpur": "MY",

  // Thailand
  "Asia/Bangkok": "TH",

  // Indonesia
  "Asia/Jakarta": "ID",

  // Philippines
  "Asia/Manila": "PH",

  // Vietnam
  "Asia/Ho_Chi_Minh": "VN",

  // South Africa
  "Africa/Johannesburg": "ZA",

  // Egypt
  "Africa/Cairo": "EG",

  // Nigeria
  "Africa/Lagos": "NG",

  // Kenya
  "Africa/Nairobi": "KE",

  // Brazil
  "America/Sao_Paulo": "BR",

  // Argentina
  "America/Argentina/Buenos_Aires": "AR",

  // Chile
  "America/Santiago": "CL",

  // Colombia
  "America/Bogota": "CO",
};

/**
 * Get country code from browser timezone
 * @returns ISO 3166-1 alpha-2 country code or null if not found
 */
export function getCountryFromTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timezoneToCountryMap[tz] || null;
  } catch {
    return null;
  }
}

/**
 * Get currency code for a country
 * @param countryCode ISO 3166-1 alpha-2 country code (e.g., "DE", "US")
 * @returns ISO 4217 currency code (defaults to USD if not found)
 */
export function getCurrencyForCountry(countryCode: string): string {
  return countryCurrencyMap[countryCode?.toUpperCase()] || "USD";
}

/**
 * Check if a currency is supported for display/payment
 */
export function isSupportedCurrency(
  currency: string
): currency is SupportedCurrency {
  return supportedCurrencies.includes(currency as SupportedCurrency);
}

/**
 * Get currency info for a currency code
 */
export function getCurrencyInfo(currency: string) {
  if (isSupportedCurrency(currency)) {
    return currencyInfo[currency];
  }
  // Return basic info for unsupported currencies
  return {
    code: currency,
    symbol: currency,
    name: currency,
    decimals: 2,
  };
}
