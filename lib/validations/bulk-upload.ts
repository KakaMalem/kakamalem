import { z } from "zod";

// Schema for a single row from CSV/Excel import
export const bulkUploadRowSchema = z.object({
  // Required fields
  name: z
    .string()
    .min(2, "Product name must be at least 2 characters")
    .max(255, "Product name must be less than 255 characters"),
  price: z
    .string()
    .refine(
      (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0,
      "Price must be a valid positive number"
    ),

  // Optional fields
  category: z.string().optional().or(z.literal("")),

  // Variant support - parent_product links variant row to its parent product
  parent_product: z.string().optional().or(z.literal("")),

  // SKU for variants (also used for main products)
  sku: z
    .string()
    .max(100, "SKU must be less than 100 characters")
    .optional()
    .or(z.literal("")),
  stock: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseInt(val)) && parseInt(val) >= 0),
      "Stock must be a valid positive number"
    )
    .optional()
    .or(z.literal("")),
  status: z
    .enum(["draft", "active", "archived"])
    .optional()
    .or(z.literal(""))
    .transform((val) => (val === "" ? "draft" : val)),
  description: z.string().optional().or(z.literal("")),
  compare_at_price: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      "Compare-at price must be a valid positive number"
    )
    .optional()
    .or(z.literal("")),
  cost_price: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      "Cost price must be a valid positive number"
    )
    .optional()
    .or(z.literal("")),
  barcode: z
    .string()
    .max(50, "Barcode must be less than 50 characters")
    .optional()
    .or(z.literal("")),
  track_inventory: z
    .string()
    .transform((val) => val.toLowerCase())
    .pipe(z.enum(["true", "false", ""]))
    .optional()
    .or(z.literal("")),
  allow_backorder: z
    .string()
    .transform((val) => val.toLowerCase())
    .pipe(z.enum(["true", "false", ""]))
    .optional()
    .or(z.literal("")),
  low_stock_threshold: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseInt(val)) && parseInt(val) >= 0),
      "Low stock threshold must be a valid positive number"
    )
    .optional()
    .or(z.literal("")),
  show_stock: z
    .string()
    .transform((val) => val.toLowerCase())
    .pipe(z.enum(["true", "false", ""]))
    .optional()
    .or(z.literal("")),
  weight: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      "Weight must be a valid positive number"
    )
    .optional()
    .or(z.literal("")),
  length: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      "Length must be a valid positive number"
    )
    .optional()
    .or(z.literal("")),
  width: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      "Width must be a valid positive number"
    )
    .optional()
    .or(z.literal("")),
  height: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      "Height must be a valid positive number"
    )
    .optional()
    .or(z.literal("")),
  show_on_storefront: z
    .string()
    .transform((val) => val.toLowerCase())
    .pipe(z.enum(["true", "false", ""]))
    .optional()
    .or(z.literal("")),
  show_on_pos: z
    .string()
    .transform((val) => val.toLowerCase())
    .pipe(z.enum(["true", "false", ""]))
    .optional()
    .or(z.literal("")),
  // Order quantity limits
  min_order_quantity: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseInt(val)) && parseInt(val) >= 1),
      "Minimum order quantity must be at least 1"
    )
    .optional()
    .or(z.literal("")),
  max_order_quantity: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseInt(val)) && parseInt(val) >= 0),
      "Maximum order quantity must be a valid positive number"
    )
    .optional()
    .or(z.literal("")),
  display_order: z
    .string()
    .refine(
      (val) => val === "" || !isNaN(parseInt(val)),
      "Display order must be a valid number"
    )
    .optional()
    .or(z.literal("")),
  // External sourcing fields
  source_url: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  source_id: z.string().optional().or(z.literal("")),
  // Images column for ZIP uploads - semicolon-separated filenames
  images: z.string().optional().or(z.literal("")),

  // Bulk pricing columns
  // Format: "minQty-maxQty:price;minQty-maxQty:price;..." e.g., "10-49:1200;50:1000"
  // maxQty can be omitted for unlimited (e.g., "50:1000" means 50+)
  price_tiers: z.string().optional().or(z.literal("")),

  // Format: "groupName:price;groupName:price:compareAtPrice;..."
  // e.g., "Wholesale:900;VIP:1000:1500"
  group_pricing: z.string().optional().or(z.literal("")),

  // Scheduled sale columns (one sale per product row)
  scheduled_sale_name: z
    .string()
    .max(255, "Sale name must be less than 255 characters")
    .optional()
    .or(z.literal("")),
  scheduled_sale_price: z
    .string()
    .refine(
      (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      "Sale price must be a valid positive number"
    )
    .optional()
    .or(z.literal("")),
  scheduled_sale_start: z.string().optional().or(z.literal("")),
  scheduled_sale_end: z.string().optional().or(z.literal("")),
});

export type BulkUploadRowInput = z.infer<typeof bulkUploadRowSchema>;

// Validated row with row number and resolved categories
export type ValidatedRow = {
  rowNumber: number;
  data: BulkUploadRowInput;
  categoryIds: string[]; // Multiple category IDs
  errors: string[];
  warnings: string[];
  isValid: boolean;
  // Variant support
  isVariant: boolean; // true if this row has a parent_product
  parentProductName?: string; // name of the parent product (for variants)
  optionValues: Record<string, string>; // e.g., { "Size": "M", "Color": "Blue" }
  // Image support for ZIP uploads
  imageFilenames: string[]; // Parsed from images column
  // Parsed pricing data
  parsedPriceTiers: Array<{
    minQuantity: number;
    maxQuantity: number | null;
    price: string;
  }>;
  parsedGroupPricing: Array<{
    groupName: string;
    price: string;
    compareAtPrice: string | null;
  }>;
  parsedScheduledSale: {
    name: string;
    salePrice: string;
    startsAt: string;
    endsAt: string;
  } | null;
};

// Bulk upload result type
export type BulkUploadResult = {
  success: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedCount: number;
  errors: Array<{ row: number; errors: string[] }>;
};

// Product limit info for UI display
export type ProductLimitInfo = {
  currentCount: number;
  limit: number | null;
  canImport: number;
};

// Parse preview result
export type ParsePreviewResult = {
  success: boolean;
  error?: string;
  rows?: ValidatedRow[];
  categoryMap?: Record<string, string>;
  productLimitInfo?: ProductLimitInfo;
  categoriesToCreate?: Record<string, string>; // Map of tempId -> original category name
  imageCount?: number; // Number of images found in ZIP (for ZIP uploads)
};

// Expected CSV/Excel headers (base headers + dynamic option_* columns)
export const EXPECTED_HEADERS = [
  "name",
  "price",
  "category",
  "images", // For ZIP uploads: semicolon-separated filenames
  "stock",
  "status",
  "description",
  "compare_at_price",
  "cost_price",
  "sku",
  "barcode",
  "track_inventory",
  "allow_backorder",
  "low_stock_threshold",
  "show_stock",
  "weight",
  "length",
  "width",
  "height",
  "show_on_storefront",
  "show_on_pos",
  "min_order_quantity",
  "max_order_quantity",
  "display_order",
  "source_url",
  "source_id",
  "parent_product", // For variants: name of the parent product
  // Bulk pricing
  "price_tiers", // Format: minQty-maxQty:price;... e.g., "10-49:1200;50:1000"
  "group_pricing", // Format: groupName:price;... e.g., "Wholesale:900;VIP:1000:1500"
  "scheduled_sale_name",
  "scheduled_sale_price",
  "scheduled_sale_start", // ISO date: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  "scheduled_sale_end",
  // Dynamic option columns (e.g., option_size, option_color) are handled separately
] as const;

export const REQUIRED_HEADERS = ["name", "price"] as const;
