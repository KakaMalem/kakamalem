/**
 * Afghanistan Geographic Data
 * 34 Provinces with major cities
 */

export type Province = {
  code: string; // ISO 3166-2:AF code
  name: string;
  nameDari: string;
  namePashto: string;
  capital: string;
  cities: string[];
};

export const AFGHANISTAN_PROVINCES: Province[] = [
  {
    code: "AF-BAL",
    name: "Balkh",
    nameDari: "بلخ",
    namePashto: "بلخ",
    capital: "Mazar-i-Sharif",
    cities: [
      "Mazar-i-Sharif",
      "Balkh",
      "Dehdadi",
      "Khulm",
      "Nahri Shahi",
      "Shortepa",
      "Chamtal",
      "Dawlatabad",
    ],
  },
  {
    code: "AF-KAB",
    name: "Kabul",
    nameDari: "کابل",
    namePashto: "کابل",
    capital: "Kabul",
    cities: [
      "Kabul",
      "Paghman",
      "Char Asiab",
      "Deh Sabz",
      "Bagrami",
      "Khaki Jabbar",
      "Musahi",
      "Surobi",
      "Guldara",
      "Istalif",
      "Mir Bacha Kot",
      "Qarabagh",
      "Kalakan",
      "Farza",
      "Shakardara",
    ],
  },
  {
    code: "AF-KAN",
    name: "Kandahar",
    nameDari: "قندهار",
    namePashto: "کندهار",
    capital: "Kandahar",
    cities: [
      "Kandahar",
      "Spin Boldak",
      "Panjwai",
      "Daman",
      "Arghandab",
      "Zhari",
      "Maiwand",
      "Shah Wali Kot",
    ],
  },
  {
    code: "AF-HER",
    name: "Herat",
    nameDari: "هرات",
    namePashto: "هرات",
    capital: "Herat",
    cities: [
      "Herat",
      "Islam Qala",
      "Shindand",
      "Guzara",
      "Injil",
      "Karrukh",
      "Zindajan",
      "Kohsan",
      "Kushk",
      "Ghoryan",
      "Adraskan",
      "Obe",
      "Chesht-e-Sharif",
      "Pashtun Zarghun",
      "Gulran",
      "Farsi",
    ],
  },
  {
    code: "AF-NAN",
    name: "Nangarhar",
    nameDari: "ننگرهار",
    namePashto: "ننګرهار",
    capital: "Jalalabad",
    cities: [
      "Jalalabad",
      "Behsud",
      "Surkhrud",
      "Khogyani",
      "Rodat",
      "Bati Kot",
      "Mohmand Dara",
      "Shinwar",
      "Achin",
      "Chaparhar",
      "Deh Bala",
      "Dur Baba",
      "Goshta",
      "Hisarak",
      "Kama",
      "Kuz Kunar",
      "Lalpura",
      "Nazyan",
      "Pachir Wa Agam",
      "Shirzad",
      "Spin Ghar",
    ],
  },
  {
    code: "AF-BAM",
    name: "Bamyan",
    nameDari: "بامیان",
    namePashto: "بامیان",
    capital: "Bamyan",
    cities: [
      "Bamyan",
      "Yakawlang",
      "Panjab",
      "Waras",
      "Shibar",
      "Sayghan",
      "Kahmard",
    ],
  },
  {
    code: "AF-BDG",
    name: "Badghis",
    nameDari: "بادغیس",
    namePashto: "بادغیس",
    capital: "Qala-i-Naw",
    cities: [
      "Qala-i-Naw",
      "Murghab",
      "Jawand",
      "Bala Murghab",
      "Qadis",
      "Ab Kamari",
      "Ghormach",
    ],
  },
  {
    code: "AF-BDS",
    name: "Badakhshan",
    nameDari: "بدخشان",
    namePashto: "بدخشان",
    capital: "Fayzabad",
    cities: [
      "Fayzabad",
      "Jurm",
      "Baharak",
      "Kishim",
      "Argo",
      "Darwaz",
      "Ishkashim",
      "Khash",
      "Keshem",
      "Raghistan",
      "Shahr-e-Buzurg",
      "Shighnan",
      "Shuhada",
      "Tagab",
      "Wakhan",
      "Warduj",
      "Yaftal-e-Sufla",
      "Yamgan",
      "Zebak",
    ],
  },
  {
    code: "AF-BGL",
    name: "Baghlan",
    nameDari: "بغلان",
    namePashto: "بغلان",
    capital: "Pul-i-Khumri",
    cities: [
      "Pul-i-Khumri",
      "Baghlan",
      "Nahrin",
      "Andarab",
      "Burka",
      "Dahana-i-Ghori",
      "Doshi",
      "Fereng",
      "Ghaziabad",
      "Khinjan",
      "Khwaja Hijran",
      "Pul-e-Hesar",
      "Tala Wa Barfak",
    ],
  },
  {
    code: "AF-DAY",
    name: "Daykundi",
    nameDari: "دایکندی",
    namePashto: "دایکندی",
    capital: "Nili",
    cities: [
      "Nili",
      "Ashtarlay",
      "Gizab",
      "Khadir",
      "Kiti",
      "Miramor",
      "Sangtakht",
      "Shahristan",
    ],
  },
  {
    code: "AF-FRA",
    name: "Farah",
    nameDari: "فراه",
    namePashto: "فراه",
    capital: "Farah",
    cities: [
      "Farah",
      "Bakwa",
      "Bala Buluk",
      "Gulistan",
      "Khaki Safed",
      "Lash Wa Juwayn",
      "Purchaman",
      "Pusht Rod",
      "Qala-i-Kah",
      "Shibkoh",
      "Anardara",
    ],
  },
  {
    code: "AF-FYB",
    name: "Faryab",
    nameDari: "فاریاب",
    namePashto: "فاریاب",
    capital: "Maymana",
    cities: [
      "Maymana",
      "Andkhoy",
      "Almar",
      "Bilchiragh",
      "Dawlatabad",
      "Garziwan",
      "Khani Char Bagh",
      "Khwaja Sabz Posh",
      "Kohistan",
      "Pashtunkot",
      "Qaramqol",
      "Qaysar",
      "Qurghan",
      "Shirin Tagab",
    ],
  },
  {
    code: "AF-GHA",
    name: "Ghazni",
    nameDari: "غزنی",
    namePashto: "غزني",
    capital: "Ghazni",
    cities: [
      "Ghazni",
      "Ab Band",
      "Ajristan",
      "Andar",
      "Dehyak",
      "Gelan",
      "Giro",
      "Jaghatu",
      "Jaghori",
      "Khwaja Omari",
      "Malistan",
      "Moqor",
      "Muqur",
      "Nawa",
      "Nawur",
      "Qarabagh",
      "Rashidan",
      "Waghaz",
      "Zanakhan",
    ],
  },
  {
    code: "AF-GHO",
    name: "Ghor",
    nameDari: "غور",
    namePashto: "غور",
    capital: "Chaghcharan",
    cities: [
      "Chaghcharan",
      "Charsadda",
      "Dawlatyar",
      "Du Layna",
      "Lal Wa Sarjangal",
      "Pasaband",
      "Saghar",
      "Shahrak",
      "Taywarah",
      "Tolak",
    ],
  },
  {
    code: "AF-HEL",
    name: "Helmand",
    nameDari: "هلمند",
    namePashto: "هلمند",
    capital: "Lashkar Gah",
    cities: [
      "Lashkar Gah",
      "Baghran",
      "Dishu",
      "Garmser",
      "Kajaki",
      "Lashkar Gah",
      "Musa Qala",
      "Nad Ali",
      "Nahr-e Saraj",
      "Nawa-i-Barakzayi",
      "Nawzad",
      "Reg",
      "Sangin",
      "Washer",
    ],
  },
  {
    code: "AF-JOW",
    name: "Jowzjan",
    nameDari: "جوزجان",
    namePashto: "جوزجان",
    capital: "Sheberghan",
    cities: [
      "Sheberghan",
      "Aqcha",
      "Darzab",
      "Fayzabad",
      "Khamyab",
      "Khaniqa",
      "Khwaja Du Koh",
      "Mardyan",
      "Mingajik",
      "Qush Tepa",
    ],
  },
  {
    code: "AF-KAP",
    name: "Kapisa",
    nameDari: "کاپیسا",
    namePashto: "کاپیسا",
    capital: "Mahmud-i-Raqi",
    cities: [
      "Mahmud-i-Raqi",
      "Alasay",
      "Hesa-e-Awal-e-Kohistan",
      "Hesa-e-Duwum-e-Kohistan",
      "Koh Band",
      "Nijrab",
      "Tagab",
    ],
  },
  {
    code: "AF-KHO",
    name: "Khost",
    nameDari: "خوست",
    namePashto: "خوست",
    capital: "Khost",
    cities: [
      "Khost",
      "Bak",
      "Gurbuz",
      "Jaji Maydan",
      "Mandozayi",
      "Matun",
      "Musa Khel",
      "Nadir Shah Kot",
      "Qalandar",
      "Sabari",
      "Shamal",
      "Spera",
      "Tani",
      "Terezayi",
    ],
  },
  {
    code: "AF-KNR",
    name: "Kunar",
    nameDari: "کنر",
    namePashto: "کنړ",
    capital: "Asadabad",
    cities: [
      "Asadabad",
      "Bar Kunar",
      "Chapa Dara",
      "Chawkay",
      "Dangam",
      "Ghaziabad",
      "Khas Kunar",
      "Marawara",
      "Narang",
      "Nari",
      "Narang Wa Badil",
      "Nurgal",
      "Pech",
      "Sawkai",
      "Shaygal Wa Sheltan",
      "Sirkanay",
      "Wata Pur",
    ],
  },
  {
    code: "AF-KDZ",
    name: "Kunduz",
    nameDari: "کندز",
    namePashto: "کندز",
    capital: "Kunduz",
    cities: [
      "Kunduz",
      "Aliabad",
      "Archi",
      "Chahar Dara",
      "Dasht-e-Archi",
      "Imam Sahib",
      "Khanabad",
      "Qala-i-Zal",
    ],
  },
  {
    code: "AF-LAG",
    name: "Laghman",
    nameDari: "لغمان",
    namePashto: "لغمان",
    capital: "Mehtarlam",
    cities: ["Mehtarlam", "Alingar", "Alishang", "Dawlat Shah", "Qarghayi"],
  },
  {
    code: "AF-LOG",
    name: "Logar",
    nameDari: "لوگر",
    namePashto: "لوګر",
    capital: "Pul-i-Alam",
    cities: [
      "Pul-i-Alam",
      "Azra",
      "Baraki Barak",
      "Charkh",
      "Kharwar",
      "Khoshi",
      "Mohammad Agha",
    ],
  },
  {
    code: "AF-NIM",
    name: "Nimroz",
    nameDari: "نیمروز",
    namePashto: "نیمروز",
    capital: "Zaranj",
    cities: ["Zaranj", "Chahar Burjak", "Chakhansur", "Kang", "Khash Rod"],
  },
  {
    code: "AF-NUR",
    name: "Nuristan",
    nameDari: "نورستان",
    namePashto: "نورستان",
    capital: "Parun",
    cities: [
      "Parun",
      "Barg-e-Matal",
      "Du Ab",
      "Kamdesh",
      "Mandol",
      "Nurgaram",
      "Wama",
      "Waygal",
    ],
  },
  {
    code: "AF-ORU",
    name: "Uruzgan",
    nameDari: "ارزگان",
    namePashto: "اروزګان",
    capital: "Tirin Kot",
    cities: [
      "Tirin Kot",
      "Chora",
      "Deh Rawud",
      "Khas Uruzgan",
      "Shahid-e-Hassas",
    ],
  },
  {
    code: "AF-PAN",
    name: "Panjshir",
    nameDari: "پنجشیر",
    namePashto: "پنجشیر",
    capital: "Bazarak",
    cities: [
      "Bazarak",
      "Anaba",
      "Dara",
      "Hesa-e-Awal",
      "Khenj",
      "Paryan",
      "Rukha",
      "Shotul",
    ],
  },
  {
    code: "AF-PAR",
    name: "Parwan",
    nameDari: "پروان",
    namePashto: "پروان",
    capital: "Charikar",
    cities: [
      "Charikar",
      "Bagram",
      "Ghorband",
      "Jabalussaraj",
      "Koh-e-Safi",
      "Salang",
      "Sayyid Khel",
      "Shekh Ali",
      "Shinwari",
      "Surkh-e-Parsa",
    ],
  },
  {
    code: "AF-PIA",
    name: "Paktia",
    nameDari: "پکتیا",
    namePashto: "پکتیا",
    capital: "Gardez",
    cities: [
      "Gardez",
      "Ahmad Aba",
      "Chamkani",
      "Dand Wa Patan",
      "Jaji",
      "Jani Khel",
      "Lija Ahmad Khel",
      "Sayyed Karam",
      "Shwak",
      "Wuza Zadran",
      "Zadran",
      "Zurmat",
    ],
  },
  {
    code: "AF-PKA",
    name: "Paktika",
    nameDari: "پکتیکا",
    namePashto: "پکتیکا",
    capital: "Sharan",
    cities: [
      "Sharan",
      "Barmal",
      "Dila",
      "Gayan",
      "Gomal",
      "Jani Khel",
      "Mata Khan",
      "Naka",
      "Omna",
      "Sar Hawza",
      "Sarobi",
      "Turwo",
      "Urgun",
      "Waza Khwa",
      "Wor Mamay",
      "Yosuf Khel",
      "Zarghun Shahr",
      "Ziruk",
    ],
  },
  {
    code: "AF-SAM",
    name: "Samangan",
    nameDari: "سمنگان",
    namePashto: "سمنګان",
    capital: "Aybak",
    cities: [
      "Aybak",
      "Dara-i-Suf-e-Bala",
      "Dara-i-Suf-e-Payin",
      "Feroz Nakhchir",
      "Hazrat-e-Sultan",
      "Khuram Wa Sarbagh",
      "Ruyi Du Ab",
    ],
  },
  {
    code: "AF-SAR",
    name: "Sar-e Pol",
    nameDari: "سرپل",
    namePashto: "سرپل",
    capital: "Sar-e Pol",
    cities: [
      "Sar-e Pol",
      "Balkhab",
      "Gosfandi",
      "Kohistanat",
      "Sangcharak",
      "Sancharak",
      "Sayad",
      "Sozma Qala",
    ],
  },
  {
    code: "AF-TAK",
    name: "Takhar",
    nameDari: "تخار",
    namePashto: "تخار",
    capital: "Taloqan",
    cities: [
      "Taloqan",
      "Baharak",
      "Bangi",
      "Chah Ab",
      "Chal",
      "Dashti Qala",
      "Darqad",
      "Eshkamesh",
      "Farkhar",
      "Hazar Sumuch",
      "Kalafgan",
      "Khwaja Bahauddin",
      "Khwaja Ghar",
      "Namak Ab",
      "Rostaq",
      "Warsaj",
      "Yangi Qala",
    ],
  },
  {
    code: "AF-WAR",
    name: "Wardak",
    nameDari: "وردک",
    namePashto: "وردګ",
    capital: "Maidan Shahr",
    cities: [
      "Maidan Shahr",
      "Chak",
      "Daimirdad",
      "Hesa-e-Awal-e-Behsud",
      "Jalrez",
      "Jaghatu",
      "Markaz-e-Behsud",
      "Nirkh",
      "Saydabad",
    ],
  },
  {
    code: "AF-ZAB",
    name: "Zabul",
    nameDari: "زابل",
    namePashto: "زابل",
    capital: "Qalat",
    cities: [
      "Qalat",
      "Arghandab",
      "Atghar",
      "Daychopan",
      "Kakar",
      "Mizan",
      "Nawbahar",
      "Shah Joy",
      "Shamalzayi",
      "Shinkay",
      "Tarnak Wa Jaldak",
    ],
  },
];

/**
 * Get all province names (for dropdown)
 */
export function getProvinceNames(): string[] {
  return AFGHANISTAN_PROVINCES.map((p) => p.name).sort();
}

/**
 * Get province by name
 */
export function getProvinceByName(name: string): Province | undefined {
  return AFGHANISTAN_PROVINCES.find(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Get all cities for a province
 */
export function getCitiesForProvince(provinceName: string): string[] {
  const province = getProvinceByName(provinceName);
  return province?.cities || [];
}

/**
 * Get all cities across all provinces (for autocomplete)
 */
export function getAllCities(): { city: string; province: string }[] {
  const cities: { city: string; province: string }[] = [];
  for (const province of AFGHANISTAN_PROVINCES) {
    for (const city of province.cities) {
      cities.push({ city, province: province.name });
    }
  }
  return cities.sort((a, b) => a.city.localeCompare(b.city));
}

/**
 * Find province by city name
 */
export function findProvinceByCity(cityName: string): Province | undefined {
  return AFGHANISTAN_PROVINCES.find((p) =>
    p.cities.some((c) => c.toLowerCase() === cityName.toLowerCase())
  );
}

/**
 * Geographic regions for grouping provinces
 */
export const AFGHANISTAN_REGIONS = {
  central: ["Kabul", "Parwan", "Kapisa", "Panjshir", "Wardak", "Logar"],
  north: [
    "Balkh",
    "Samangan",
    "Kunduz",
    "Takhar",
    "Baghlan",
    "Badakhshan",
    "Jowzjan",
    "Sar-e Pol",
    "Faryab",
  ],
  south: ["Kandahar", "Helmand", "Zabul", "Uruzgan", "Nimroz"],
  east: [
    "Nangarhar",
    "Laghman",
    "Kunar",
    "Nuristan",
    "Khost",
    "Paktia",
    "Paktika",
  ],
  west: ["Herat", "Farah", "Badghis", "Ghor"],
  central_highlands: ["Bamyan", "Daykundi", "Ghazni"],
} as const;

export type AfghanistanRegion = keyof typeof AFGHANISTAN_REGIONS;

/**
 * Get region for a province
 */
export function getRegionForProvince(
  provinceName: string
): AfghanistanRegion | null {
  for (const [region, provinces] of Object.entries(AFGHANISTAN_REGIONS)) {
    if ((provinces as readonly string[]).includes(provinceName)) {
      return region as AfghanistanRegion;
    }
  }
  return null;
}

/**
 * Region display names
 */
export const REGION_NAMES: Record<AfghanistanRegion, string> = {
  central: "Central Region",
  north: "Northern Region",
  south: "Southern Region",
  east: "Eastern Region",
  west: "Western Region",
  central_highlands: "Central Highlands",
};
