// =============================================================================
// AMAZON PRODUCT SCRAPER TYPES
// =============================================================================

export interface AmazonImage {
  hiRes: string | null;
  large: string | null;
  thumb: string | null;
  /** Image variant key (e.g., "MAIN", "PT01", "PT02") */
  variant?: string;
}

export interface AmazonVariantValue {
  value: string;
  asin?: string;
  imageUrl?: string;
}

export interface AmazonVariantOption {
  name: string;
  values: AmazonVariantValue[];
}

export interface AmazonVariant {
  asin: string;
  title: string;
  /** e.g., { "Color": "Blue", "Size": "XL" } */
  options: Record<string, string>;
  price: number | null;
  images: AmazonImage[];
  available: boolean;
}

export interface AmazonProduct {
  title: string;
  /** HTML product description */
  description: string;
  /** Feature bullet points */
  featureBullets: string[];
  price: number | null;
  /** Currency code (e.g., "AED", "USD") */
  currency: string;
  compareAtPrice: number | null;
  /** Main product images */
  images: AmazonImage[];
  /** Color/Size variant combinations */
  variants: AmazonVariant[];
  /** Option types with their values */
  variantOptions: AmazonVariantOption[];
  /** Technical specifications */
  specifications: Record<string, string>;
  asin: string;
  url: string;
  brand: string | null;
  rating: number | null;
  reviewCount: number | null;
}

export interface ScrapeResult {
  success: boolean;
  product?: AmazonProduct;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  productId?: string;
  productSlug?: string;
  warnings: string[];
  error?: string;
}
