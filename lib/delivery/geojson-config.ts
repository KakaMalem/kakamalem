// GeoJSON configuration and region presets

export const GEOJSON_PATHS = {
  // World countries (will be loaded from public folder)
  countries: "/data/geojson/countries-110m.geojson",

  // Afghanistan provinces (for detailed local view)
  afghanistanProvinces: "/data/geojson/afghanistan-provinces.geojson",
} as const;

// Common region presets for bulk country selection
export const REGION_PRESETS = {
  middleEast: {
    name: "Middle East",
    countries: [
      "AF",
      "IR",
      "IQ",
      "SY",
      "JO",
      "LB",
      "IL",
      "PS",
      "YE",
      "OM",
      "AE",
      "SA",
      "KW",
      "BH",
      "QA",
    ],
  },
  centralAsia: {
    name: "Central Asia",
    countries: ["AF", "KZ", "UZ", "TM", "TJ", "KG"],
  },
  southAsia: {
    name: "South Asia",
    countries: ["AF", "PK", "IN", "BD", "LK", "NP", "BT", "MV"],
  },
  gulfStates: {
    name: "Gulf States (GCC)",
    countries: ["AE", "SA", "KW", "BH", "QA", "OM"],
  },
  europe: {
    name: "Europe",
    countries: [
      "AL",
      "AD",
      "AT",
      "BY",
      "BE",
      "BA",
      "BG",
      "HR",
      "CY",
      "CZ",
      "DK",
      "EE",
      "FI",
      "FR",
      "DE",
      "GR",
      "HU",
      "IS",
      "IE",
      "IT",
      "XK",
      "LV",
      "LI",
      "LT",
      "LU",
      "MT",
      "MD",
      "MC",
      "ME",
      "NL",
      "MK",
      "NO",
      "PL",
      "PT",
      "RO",
      "RU",
      "SM",
      "RS",
      "SK",
      "SI",
      "ES",
      "SE",
      "CH",
      "UA",
      "GB",
      "VA",
    ],
  },
  northAmerica: {
    name: "North America",
    countries: ["US", "CA", "MX"],
  },
  oceania: {
    name: "Oceania",
    countries: ["AU", "NZ", "FJ", "PG", "WS", "TO", "VU", "SB"],
  },
} as const;

export type RegionPresetKey = keyof typeof REGION_PRESETS;

// Country name lookup (common countries)
export const COUNTRY_NAMES: Record<string, string> = {
  AF: "Afghanistan",
  PK: "Pakistan",
  IR: "Iran",
  IN: "India",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  TR: "Turkey",
  IQ: "Iraq",
  SY: "Syria",
  JO: "Jordan",
  LB: "Lebanon",
  KW: "Kuwait",
  BH: "Bahrain",
  QA: "Qatar",
  OM: "Oman",
  YE: "Yemen",
  KZ: "Kazakhstan",
  UZ: "Uzbekistan",
  TM: "Turkmenistan",
  TJ: "Tajikistan",
  KG: "Kyrgyzstan",
  BD: "Bangladesh",
  LK: "Sri Lanka",
  NP: "Nepal",
  BT: "Bhutan",
  MV: "Maldives",
  US: "United States",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  IT: "Italy",
  ES: "Spain",
  NL: "Netherlands",
  BE: "Belgium",
  AT: "Austria",
  CH: "Switzerland",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  PL: "Poland",
  CZ: "Czechia",
  RO: "Romania",
  HU: "Hungary",
  GR: "Greece",
  PT: "Portugal",
  IE: "Ireland",
  AU: "Australia",
  NZ: "New Zealand",
  CA: "Canada",
  MX: "Mexico",
  BR: "Brazil",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  JP: "Japan",
  KR: "South Korea",
  CN: "China",
  SG: "Singapore",
  MY: "Malaysia",
  TH: "Thailand",
  VN: "Vietnam",
  ID: "Indonesia",
  PH: "Philippines",
  EG: "Egypt",
  ZA: "South Africa",
  NG: "Nigeria",
  KE: "Kenya",
  MA: "Morocco",
  RU: "Russia",
  UA: "Ukraine",
};

// Get country name by ISO code
export function getCountryName(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] || code;
}

// Get country flag emoji by ISO code
export function getCountryFlag(code: string): string {
  if (!code || code.length !== 2) return "";

  const codePoints = code
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));

  return String.fromCodePoint(...codePoints);
}

// Format radius for display
export function formatRadius(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km % 1 === 0 ? km : km.toFixed(1)} km`;
  }
  return `${meters} m`;
}

// Default map center (Kabul, Afghanistan)
export const DEFAULT_MAP_CENTER: [number, number] = [34.5553, 69.2075];
export const DEFAULT_MAP_ZOOM = 3;

// Zone colors palette
export const ZONE_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
] as const;

export function getNextZoneColor(usedColors: string[]): string {
  const available = ZONE_COLORS.filter((c) => !usedColors.includes(c));
  return (
    available[0] || ZONE_COLORS[Math.floor(Math.random() * ZONE_COLORS.length)]
  );
}
