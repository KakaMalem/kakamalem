/**
 * Pre-defined option templates for common product types.
 * These templates provide quick-start options for merchants.
 */

export type OptionTemplate = {
  id: string;
  name: string;
  category: string;
  description: string;
  options: {
    name: string;
    values: {
      value: string;
      swatchType: "text" | "color" | "image";
      swatchValue?: string; // Hex color for color type
    }[];
  }[];
};

export const OPTION_TEMPLATES: OptionTemplate[] = [
  // ============================================================================
  // CLOTHING TEMPLATES
  // ============================================================================
  {
    id: "clothing-basic",
    name: "Basic Clothing",
    category: "Clothing",
    description: "Size and Color options for general apparel",
    options: [
      {
        name: "Size",
        values: [
          { value: "XS", swatchType: "text" },
          { value: "S", swatchType: "text" },
          { value: "M", swatchType: "text" },
          { value: "L", swatchType: "text" },
          { value: "XL", swatchType: "text" },
          { value: "XXL", swatchType: "text" },
        ],
      },
      {
        name: "Color",
        values: [
          { value: "Black", swatchType: "color", swatchValue: "#000000" },
          { value: "White", swatchType: "color", swatchValue: "#FFFFFF" },
          { value: "Navy", swatchType: "color", swatchValue: "#1E3A5F" },
          { value: "Gray", swatchType: "color", swatchValue: "#6B7280" },
          { value: "Red", swatchType: "color", swatchValue: "#DC2626" },
        ],
      },
    ],
  },
  {
    id: "clothing-tshirt",
    name: "T-Shirts",
    category: "Clothing",
    description: "Common sizes and colors for t-shirts",
    options: [
      {
        name: "Size",
        values: [
          { value: "S", swatchType: "text" },
          { value: "M", swatchType: "text" },
          { value: "L", swatchType: "text" },
          { value: "XL", swatchType: "text" },
        ],
      },
      {
        name: "Color",
        values: [
          { value: "Black", swatchType: "color", swatchValue: "#000000" },
          { value: "White", swatchType: "color", swatchValue: "#FFFFFF" },
          {
            value: "Heather Gray",
            swatchType: "color",
            swatchValue: "#9CA3AF",
          },
          { value: "Navy Blue", swatchType: "color", swatchValue: "#1E40AF" },
          {
            value: "Forest Green",
            swatchType: "color",
            swatchValue: "#166534",
          },
        ],
      },
    ],
  },
  {
    id: "clothing-dress",
    name: "Dresses",
    category: "Clothing",
    description: "Standard dress sizes with elegant colors",
    options: [
      {
        name: "Size",
        values: [
          { value: "XS", swatchType: "text" },
          { value: "S", swatchType: "text" },
          { value: "M", swatchType: "text" },
          { value: "L", swatchType: "text" },
          { value: "XL", swatchType: "text" },
        ],
      },
      {
        name: "Color",
        values: [
          { value: "Black", swatchType: "color", swatchValue: "#000000" },
          { value: "Burgundy", swatchType: "color", swatchValue: "#722F37" },
          { value: "Navy", swatchType: "color", swatchValue: "#1E3A5F" },
          { value: "Blush Pink", swatchType: "color", swatchValue: "#FFB6C1" },
          { value: "Emerald", swatchType: "color", swatchValue: "#047857" },
        ],
      },
    ],
  },

  // ============================================================================
  // FOOTWEAR TEMPLATES
  // ============================================================================
  {
    id: "footwear-us",
    name: "US Shoe Sizes",
    category: "Footwear",
    description: "Standard US shoe sizes for men and women",
    options: [
      {
        name: "Size",
        values: [
          { value: "6", swatchType: "text" },
          { value: "6.5", swatchType: "text" },
          { value: "7", swatchType: "text" },
          { value: "7.5", swatchType: "text" },
          { value: "8", swatchType: "text" },
          { value: "8.5", swatchType: "text" },
          { value: "9", swatchType: "text" },
          { value: "9.5", swatchType: "text" },
          { value: "10", swatchType: "text" },
          { value: "10.5", swatchType: "text" },
          { value: "11", swatchType: "text" },
          { value: "12", swatchType: "text" },
        ],
      },
      {
        name: "Color",
        values: [
          { value: "Black", swatchType: "color", swatchValue: "#000000" },
          { value: "Brown", swatchType: "color", swatchValue: "#8B4513" },
          { value: "White", swatchType: "color", swatchValue: "#FFFFFF" },
          { value: "Tan", swatchType: "color", swatchValue: "#D2B48C" },
        ],
      },
    ],
  },
  {
    id: "footwear-eu",
    name: "EU Shoe Sizes",
    category: "Footwear",
    description: "European shoe sizes",
    options: [
      {
        name: "Size",
        values: [
          { value: "36", swatchType: "text" },
          { value: "37", swatchType: "text" },
          { value: "38", swatchType: "text" },
          { value: "39", swatchType: "text" },
          { value: "40", swatchType: "text" },
          { value: "41", swatchType: "text" },
          { value: "42", swatchType: "text" },
          { value: "43", swatchType: "text" },
          { value: "44", swatchType: "text" },
          { value: "45", swatchType: "text" },
          { value: "46", swatchType: "text" },
        ],
      },
    ],
  },
  {
    id: "footwear-sneakers",
    name: "Sneakers",
    category: "Footwear",
    description: "Sneaker sizes with popular colorways",
    options: [
      {
        name: "Size",
        values: [
          { value: "7", swatchType: "text" },
          { value: "8", swatchType: "text" },
          { value: "9", swatchType: "text" },
          { value: "10", swatchType: "text" },
          { value: "11", swatchType: "text" },
          { value: "12", swatchType: "text" },
        ],
      },
      {
        name: "Color",
        values: [
          {
            value: "Triple Black",
            swatchType: "color",
            swatchValue: "#0A0A0A",
          },
          {
            value: "Triple White",
            swatchType: "color",
            swatchValue: "#FAFAFA",
          },
          { value: "Bred", swatchType: "color", swatchValue: "#B91C1C" },
          { value: "Royal Blue", swatchType: "color", swatchValue: "#1D4ED8" },
        ],
      },
    ],
  },

  // ============================================================================
  // JEWELRY TEMPLATES
  // ============================================================================
  {
    id: "jewelry-rings",
    name: "Ring Sizes",
    category: "Jewelry",
    description: "Standard ring sizes with metal options",
    options: [
      {
        name: "Size",
        values: [
          { value: "5", swatchType: "text" },
          { value: "6", swatchType: "text" },
          { value: "7", swatchType: "text" },
          { value: "8", swatchType: "text" },
          { value: "9", swatchType: "text" },
          { value: "10", swatchType: "text" },
          { value: "11", swatchType: "text" },
        ],
      },
      {
        name: "Metal",
        values: [
          { value: "Gold", swatchType: "color", swatchValue: "#FFD700" },
          { value: "Rose Gold", swatchType: "color", swatchValue: "#B76E79" },
          { value: "Silver", swatchType: "color", swatchValue: "#C0C0C0" },
          { value: "Platinum", swatchType: "color", swatchValue: "#E5E4E2" },
        ],
      },
    ],
  },
  {
    id: "jewelry-necklaces",
    name: "Necklaces",
    category: "Jewelry",
    description: "Necklace lengths with metal finishes",
    options: [
      {
        name: "Length",
        values: [
          { value: '14"', swatchType: "text" },
          { value: '16"', swatchType: "text" },
          { value: '18"', swatchType: "text" },
          { value: '20"', swatchType: "text" },
          { value: '24"', swatchType: "text" },
        ],
      },
      {
        name: "Metal",
        values: [
          { value: "Gold", swatchType: "color", swatchValue: "#FFD700" },
          { value: "Silver", swatchType: "color", swatchValue: "#C0C0C0" },
          { value: "Rose Gold", swatchType: "color", swatchValue: "#B76E79" },
        ],
      },
    ],
  },

  // ============================================================================
  // ELECTRONICS TEMPLATES
  // ============================================================================
  {
    id: "electronics-phone",
    name: "Phone Storage",
    category: "Electronics",
    description: "Common phone storage and color options",
    options: [
      {
        name: "Storage",
        values: [
          { value: "64GB", swatchType: "text" },
          { value: "128GB", swatchType: "text" },
          { value: "256GB", swatchType: "text" },
          { value: "512GB", swatchType: "text" },
          { value: "1TB", swatchType: "text" },
        ],
      },
      {
        name: "Color",
        values: [
          { value: "Midnight", swatchType: "color", swatchValue: "#1C1C1E" },
          { value: "Silver", swatchType: "color", swatchValue: "#E5E5E7" },
          { value: "Gold", swatchType: "color", swatchValue: "#F5E6D3" },
          { value: "Deep Purple", swatchType: "color", swatchValue: "#5B4B8A" },
          { value: "Blue", swatchType: "color", swatchValue: "#A1C5D1" },
        ],
      },
    ],
  },
  {
    id: "electronics-laptop",
    name: "Laptop Specs",
    category: "Electronics",
    description: "Common laptop RAM and storage options",
    options: [
      {
        name: "RAM",
        values: [
          { value: "8GB", swatchType: "text" },
          { value: "16GB", swatchType: "text" },
          { value: "32GB", swatchType: "text" },
          { value: "64GB", swatchType: "text" },
        ],
      },
      {
        name: "Storage",
        values: [
          { value: "256GB SSD", swatchType: "text" },
          { value: "512GB SSD", swatchType: "text" },
          { value: "1TB SSD", swatchType: "text" },
          { value: "2TB SSD", swatchType: "text" },
        ],
      },
    ],
  },

  // ============================================================================
  // HOME & FURNITURE TEMPLATES
  // ============================================================================
  {
    id: "furniture-bedding",
    name: "Bedding Sizes",
    category: "Home & Furniture",
    description: "Standard bed sizes with fabric options",
    options: [
      {
        name: "Size",
        values: [
          { value: "Twin", swatchType: "text" },
          { value: "Twin XL", swatchType: "text" },
          { value: "Full", swatchType: "text" },
          { value: "Queen", swatchType: "text" },
          { value: "King", swatchType: "text" },
          { value: "California King", swatchType: "text" },
        ],
      },
      {
        name: "Color",
        values: [
          { value: "White", swatchType: "color", swatchValue: "#FFFFFF" },
          { value: "Ivory", swatchType: "color", swatchValue: "#FFFFF0" },
          { value: "Gray", swatchType: "color", swatchValue: "#808080" },
          { value: "Navy", swatchType: "color", swatchValue: "#1E3A5F" },
          { value: "Sage", swatchType: "color", swatchValue: "#9DC183" },
        ],
      },
    ],
  },
  {
    id: "furniture-towels",
    name: "Towel Sets",
    category: "Home & Furniture",
    description: "Towel sizes with colors",
    options: [
      {
        name: "Size",
        values: [
          { value: "Hand Towel", swatchType: "text" },
          { value: "Bath Towel", swatchType: "text" },
          { value: "Bath Sheet", swatchType: "text" },
          { value: "Set of 6", swatchType: "text" },
        ],
      },
      {
        name: "Color",
        values: [
          { value: "White", swatchType: "color", swatchValue: "#FFFFFF" },
          { value: "Gray", swatchType: "color", swatchValue: "#6B7280" },
          { value: "Navy", swatchType: "color", swatchValue: "#1E3A5F" },
          { value: "Blush", swatchType: "color", swatchValue: "#FFB6C1" },
        ],
      },
    ],
  },

  // ============================================================================
  // BEAUTY & COSMETICS TEMPLATES
  // ============================================================================
  {
    id: "beauty-foundation",
    name: "Foundation Shades",
    category: "Beauty",
    description: "Foundation shade ranges",
    options: [
      {
        name: "Shade",
        values: [
          { value: "Fair", swatchType: "color", swatchValue: "#F5DEB3" },
          { value: "Light", swatchType: "color", swatchValue: "#DEBA95" },
          { value: "Medium", swatchType: "color", swatchValue: "#C68642" },
          { value: "Tan", swatchType: "color", swatchValue: "#8B5A2B" },
          { value: "Deep", swatchType: "color", swatchValue: "#5C3317" },
        ],
      },
      {
        name: "Undertone",
        values: [
          { value: "Warm", swatchType: "color", swatchValue: "#FFE4B5" },
          { value: "Neutral", swatchType: "color", swatchValue: "#DEB887" },
          { value: "Cool", swatchType: "color", swatchValue: "#FFDAB9" },
        ],
      },
    ],
  },
  {
    id: "beauty-lipstick",
    name: "Lipstick Colors",
    category: "Beauty",
    description: "Popular lipstick shades",
    options: [
      {
        name: "Color",
        values: [
          { value: "Classic Red", swatchType: "color", swatchValue: "#DC143C" },
          { value: "Nude", swatchType: "color", swatchValue: "#E8C4A2" },
          { value: "Berry", swatchType: "color", swatchValue: "#8E4585" },
          { value: "Coral", swatchType: "color", swatchValue: "#FF7F50" },
          { value: "Mauve", swatchType: "color", swatchValue: "#E0B0FF" },
          { value: "Plum", swatchType: "color", swatchValue: "#8B0045" },
        ],
      },
      {
        name: "Finish",
        values: [
          { value: "Matte", swatchType: "text" },
          { value: "Satin", swatchType: "text" },
          { value: "Glossy", swatchType: "text" },
        ],
      },
    ],
  },

  // ============================================================================
  // SIMPLE TEMPLATES
  // ============================================================================
  {
    id: "simple-size-only",
    name: "Size Only",
    category: "Simple",
    description: "Just standard sizes without colors",
    options: [
      {
        name: "Size",
        values: [
          { value: "Small", swatchType: "text" },
          { value: "Medium", swatchType: "text" },
          { value: "Large", swatchType: "text" },
        ],
      },
    ],
  },
  {
    id: "simple-color-only",
    name: "Color Only",
    category: "Simple",
    description: "Basic color options",
    options: [
      {
        name: "Color",
        values: [
          { value: "Black", swatchType: "color", swatchValue: "#000000" },
          { value: "White", swatchType: "color", swatchValue: "#FFFFFF" },
          { value: "Gray", swatchType: "color", swatchValue: "#808080" },
          { value: "Blue", swatchType: "color", swatchValue: "#0066CC" },
          { value: "Red", swatchType: "color", swatchValue: "#CC0000" },
          { value: "Green", swatchType: "color", swatchValue: "#00CC00" },
        ],
      },
    ],
  },
  {
    id: "simple-material",
    name: "Material Options",
    category: "Simple",
    description: "Common material choices",
    options: [
      {
        name: "Material",
        values: [
          { value: "Cotton", swatchType: "text" },
          { value: "Polyester", swatchType: "text" },
          { value: "Linen", swatchType: "text" },
          { value: "Silk", swatchType: "text" },
          { value: "Wool", swatchType: "text" },
        ],
      },
    ],
  },
];

// Get unique categories for filtering
export const TEMPLATE_CATEGORIES = [
  ...new Set(OPTION_TEMPLATES.map((t) => t.category)),
];

// Helper to find template by ID
export function getTemplateById(id: string): OptionTemplate | undefined {
  return OPTION_TEMPLATES.find((t) => t.id === id);
}

// Helper to get templates by category
export function getTemplatesByCategory(category: string): OptionTemplate[] {
  return OPTION_TEMPLATES.filter((t) => t.category === category);
}

// Common color palette for manual color selection
export const COLOR_PALETTE = [
  // Neutrals
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Gray", hex: "#6B7280" },
  { name: "Light Gray", hex: "#D1D5DB" },
  { name: "Dark Gray", hex: "#374151" },
  // Reds
  { name: "Red", hex: "#DC2626" },
  { name: "Burgundy", hex: "#722F37" },
  { name: "Coral", hex: "#FF7F50" },
  { name: "Rose", hex: "#FF007F" },
  // Blues
  { name: "Blue", hex: "#2563EB" },
  { name: "Navy", hex: "#1E3A5F" },
  { name: "Sky Blue", hex: "#38BDF8" },
  { name: "Teal", hex: "#14B8A6" },
  // Greens
  { name: "Green", hex: "#22C55E" },
  { name: "Forest", hex: "#166534" },
  { name: "Olive", hex: "#808000" },
  { name: "Sage", hex: "#9DC183" },
  // Yellows & Oranges
  { name: "Yellow", hex: "#EAB308" },
  { name: "Gold", hex: "#FFD700" },
  { name: "Orange", hex: "#F97316" },
  { name: "Amber", hex: "#F59E0B" },
  // Purples & Pinks
  { name: "Purple", hex: "#9333EA" },
  { name: "Lavender", hex: "#E9D5FF" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Blush", hex: "#FFB6C1" },
  // Browns & Tans
  { name: "Brown", hex: "#8B4513" },
  { name: "Tan", hex: "#D2B48C" },
  { name: "Beige", hex: "#F5F5DC" },
  { name: "Cream", hex: "#FFFDD0" },
];
