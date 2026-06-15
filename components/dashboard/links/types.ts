import type { LinkTargetType } from "@/lib/validations/links";

/** A marketing link as rendered in the dashboard. */
export interface LinkRow {
  id: string;
  code: string;
  name: string | null;
  targetType: string;
  productId: string | null;
  categoryId: string | null;
  targetUrl: string | null;
  productName: string | null;
  categoryName: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  totalClicks: number;
  uniqueClicks: number;
  totalConversions: number;
  totalRevenue: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface PickerItem {
  id: string;
  name: string;
  slug: string;
}

export const TARGET_LABELS: Record<LinkTargetType, string> = {
  store: "Store home",
  product: "Product",
  category: "Category",
  url: "Custom URL",
};
