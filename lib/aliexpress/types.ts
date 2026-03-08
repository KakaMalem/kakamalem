// =============================================================================
// ALIEXPRESS PRODUCT TYPES
// =============================================================================

export interface AliExpressImage {
  url: string;
  /** Image variant key */
  variant?: string;
}

export interface AliExpressVariantValue {
  value: string;
  imageUrl?: string;
  skuId?: string;
}

export interface AliExpressVariantOption {
  name: string;
  values: AliExpressVariantValue[];
}

export interface AliExpressVariant {
  skuId: string;
  /** e.g., { "Color": "Blue", "Size": "XL" } */
  options: Record<string, string>;
  price: number | null;
  originalPrice: number | null;
  stock: number;
  available: boolean;
}

export interface AliExpressProduct {
  title: string;
  /** HTML product description */
  description: string;
  /** Feature highlights */
  features: string[];
  price: number | null;
  /** Currency code (e.g., "USD") */
  currency: string;
  originalPrice: number | null;
  /** Main product images */
  images: AliExpressImage[];
  /** Variant combinations */
  variants: AliExpressVariant[];
  /** Option types with their values */
  variantOptions: AliExpressVariantOption[];
  /** Technical specifications */
  specifications: Record<string, string>;
  productId: string;
  url: string;
  storeName: string | null;
  storeUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  orderCount: number | null;
  shippingInfo: string | null;
}

export interface AliExpressScrapeResult {
  success: boolean;
  product?: AliExpressProduct;
  /** Price converted to store currency (AFN) */
  convertedPrice?: number;
  /** Original price converted to store currency (AFN) */
  convertedOriginalPrice?: number;
  error?: string;
}

export interface AliExpressImportResult {
  success: boolean;
  productId?: string;
  productSlug?: string;
  warnings: string[];
  error?: string;
}
