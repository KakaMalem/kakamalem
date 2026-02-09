import { db } from "@/lib/db";
import { saleCampaigns, categories, products } from "@/lib/db/schema";
import { eq, and, desc, asc, lte, gte, sql, inArray } from "drizzle-orm";
import {
  getCampaignStatus,
  type CampaignStatus,
} from "@/lib/validations/campaigns";

// =============================================================================
// TYPES
// =============================================================================

export type CampaignWithStats = {
  id: string;
  name: string;
  description: string | null;
  slug: string | null;
  discountType: "percentage" | "fixed_amount";
  discountValue: string;
  scope: "store_wide" | "categories" | "products";
  eligibleCategories: string[] | null;
  eligibleProducts: string[] | null;
  excludedProducts: string[] | null;
  startsAt: string;
  endsAt: string;
  minimumOrderAmount: string | null;
  showBadge: boolean;
  badgeText: string | null;
  bannerImage: string | null;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
  status: CampaignStatus;
  // Stats
  categoryCount: number;
  productCount: number;
};

export type CampaignDetails = CampaignWithStats & {
  categoryNames: string[];
  productNames: string[];
};

// =============================================================================
// DASHBOARD QUERIES
// =============================================================================

/**
 * Get all campaigns for a tenant with computed status
 */
export async function getCampaigns(
  tenantId: string
): Promise<CampaignWithStats[]> {
  const campaigns = await db.query.saleCampaigns.findMany({
    where: eq(saleCampaigns.tenantId, tenantId),
    orderBy: [desc(saleCampaigns.createdAt)],
  });

  return campaigns.map((campaign) => ({
    ...campaign,
    status: getCampaignStatus(campaign),
    categoryCount: campaign.eligibleCategories?.length ?? 0,
    productCount: campaign.eligibleProducts?.length ?? 0,
  }));
}

/**
 * Get a single campaign by ID with full details
 */
export async function getCampaignById(
  tenantId: string,
  campaignId: string
): Promise<CampaignDetails | null> {
  const campaign = await db.query.saleCampaigns.findFirst({
    where: and(
      eq(saleCampaigns.id, campaignId),
      eq(saleCampaigns.tenantId, tenantId)
    ),
  });

  if (!campaign) return null;

  // Fetch category names if applicable
  let categoryNames: string[] = [];
  if (campaign.eligibleCategories && campaign.eligibleCategories.length > 0) {
    const cats = await db.query.categories.findMany({
      where: inArray(categories.id, campaign.eligibleCategories),
      columns: { name: true },
    });
    categoryNames = cats.map((c) => c.name);
  }

  // Fetch product names if applicable
  let productNames: string[] = [];
  if (campaign.eligibleProducts && campaign.eligibleProducts.length > 0) {
    const prods = await db.query.products.findMany({
      where: inArray(products.id, campaign.eligibleProducts),
      columns: { name: true },
    });
    productNames = prods.map((p) => p.name);
  }

  return {
    ...campaign,
    status: getCampaignStatus(campaign),
    categoryCount: campaign.eligibleCategories?.length ?? 0,
    productCount: campaign.eligibleProducts?.length ?? 0,
    categoryNames,
    productNames,
  };
}

/**
 * Check if a slug is unique within a tenant
 */
export async function isCampaignSlugUnique(
  tenantId: string,
  slug: string,
  excludeId?: string
): Promise<boolean> {
  const existing = await db.query.saleCampaigns.findFirst({
    where: and(
      eq(saleCampaigns.tenantId, tenantId),
      eq(saleCampaigns.slug, slug),
      excludeId ? sql`${saleCampaigns.id} != ${excludeId}` : undefined
    ),
    columns: { id: true },
  });

  return !existing;
}

// =============================================================================
// STOREFRONT QUERIES
// =============================================================================

/**
 * Get all active campaigns for a tenant (for storefront display)
 */
export async function getActiveCampaigns(tenantId: string) {
  const now = new Date().toISOString();

  return db.query.saleCampaigns.findMany({
    where: and(
      eq(saleCampaigns.tenantId, tenantId),
      eq(saleCampaigns.isActive, true),
      lte(saleCampaigns.startsAt, now),
      gte(saleCampaigns.endsAt, now)
    ),
    orderBy: [desc(saleCampaigns.priority), asc(saleCampaigns.startsAt)],
  });
}

/**
 * Get the best applicable campaign discount for a product
 * Returns the highest priority active campaign that applies to this product
 */
export async function getProductCampaignDiscount(
  tenantId: string,
  productId: string,
  categoryId: string | null
): Promise<{
  campaignId: string;
  campaignName: string;
  discountType: "percentage" | "fixed_amount";
  discountValue: number;
  badgeText: string | null;
} | null> {
  const now = new Date().toISOString();

  // Get all active campaigns for this tenant
  const campaigns = await db.query.saleCampaigns.findMany({
    where: and(
      eq(saleCampaigns.tenantId, tenantId),
      eq(saleCampaigns.isActive, true),
      lte(saleCampaigns.startsAt, now),
      gte(saleCampaigns.endsAt, now)
    ),
    orderBy: [desc(saleCampaigns.priority)],
  });

  // Find the first (highest priority) campaign that applies to this product
  for (const campaign of campaigns) {
    // Check if product is excluded
    if (
      campaign.excludedProducts &&
      campaign.excludedProducts.includes(productId)
    ) {
      continue;
    }

    // Check scope
    if (campaign.scope === "store_wide") {
      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        discountType: campaign.discountType,
        discountValue: parseFloat(campaign.discountValue),
        badgeText: campaign.showBadge ? campaign.badgeText : null,
      };
    }

    if (
      campaign.scope === "categories" &&
      categoryId &&
      campaign.eligibleCategories?.includes(categoryId)
    ) {
      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        discountType: campaign.discountType,
        discountValue: parseFloat(campaign.discountValue),
        badgeText: campaign.showBadge ? campaign.badgeText : null,
      };
    }

    if (
      campaign.scope === "products" &&
      campaign.eligibleProducts?.includes(productId)
    ) {
      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        discountType: campaign.discountType,
        discountValue: parseFloat(campaign.discountValue),
        badgeText: campaign.showBadge ? campaign.badgeText : null,
      };
    }
  }

  return null;
}

/**
 * Get campaign by slug (for landing pages)
 */
export async function getCampaignBySlug(
  tenantId: string,
  slug: string
): Promise<CampaignDetails | null> {
  const campaign = await db.query.saleCampaigns.findFirst({
    where: and(
      eq(saleCampaigns.tenantId, tenantId),
      eq(saleCampaigns.slug, slug)
    ),
  });

  if (!campaign) return null;

  // Fetch names for display
  let categoryNames: string[] = [];
  if (campaign.eligibleCategories && campaign.eligibleCategories.length > 0) {
    const cats = await db.query.categories.findMany({
      where: inArray(categories.id, campaign.eligibleCategories),
      columns: { name: true },
    });
    categoryNames = cats.map((c) => c.name);
  }

  let productNames: string[] = [];
  if (campaign.eligibleProducts && campaign.eligibleProducts.length > 0) {
    const prods = await db.query.products.findMany({
      where: inArray(products.id, campaign.eligibleProducts),
      columns: { name: true },
    });
    productNames = prods.map((p) => p.name);
  }

  return {
    ...campaign,
    status: getCampaignStatus(campaign),
    categoryCount: campaign.eligibleCategories?.length ?? 0,
    productCount: campaign.eligibleProducts?.length ?? 0,
    categoryNames,
    productNames,
  };
}

/**
 * Batch get campaign discounts for multiple products
 * Returns a Map of productId -> discount info
 */
export async function getProductsCampaignDiscounts(
  tenantId: string,
  productInfos: Array<{ productId: string; categoryId: string | null }>
): Promise<
  Map<
    string,
    {
      campaignId: string;
      campaignName: string;
      discountType: "percentage" | "fixed_amount";
      discountValue: number;
      badgeText: string | null;
    }
  >
> {
  const now = new Date().toISOString();

  // Get all active campaigns for this tenant (ordered by priority)
  const campaigns = await db.query.saleCampaigns.findMany({
    where: and(
      eq(saleCampaigns.tenantId, tenantId),
      eq(saleCampaigns.isActive, true),
      lte(saleCampaigns.startsAt, now),
      gte(saleCampaigns.endsAt, now)
    ),
    orderBy: [desc(saleCampaigns.priority)],
  });

  if (campaigns.length === 0) {
    return new Map();
  }

  const results = new Map<
    string,
    {
      campaignId: string;
      campaignName: string;
      discountType: "percentage" | "fixed_amount";
      discountValue: number;
      badgeText: string | null;
    }
  >();

  // For each product, find the first applicable campaign
  for (const { productId, categoryId } of productInfos) {
    for (const campaign of campaigns) {
      // Check if product is excluded
      if (
        campaign.excludedProducts &&
        campaign.excludedProducts.includes(productId)
      ) {
        continue;
      }

      let applies = false;

      // Check scope
      if (campaign.scope === "store_wide") {
        applies = true;
      } else if (
        campaign.scope === "categories" &&
        categoryId &&
        campaign.eligibleCategories?.includes(categoryId)
      ) {
        applies = true;
      } else if (
        campaign.scope === "products" &&
        campaign.eligibleProducts?.includes(productId)
      ) {
        applies = true;
      }

      if (applies) {
        results.set(productId, {
          campaignId: campaign.id,
          campaignName: campaign.name,
          discountType: campaign.discountType,
          discountValue: parseFloat(campaign.discountValue),
          badgeText: campaign.showBadge ? campaign.badgeText : null,
        });
        break; // Found highest priority campaign for this product
      }
    }
  }

  return results;
}

/**
 * Get products in a campaign (for campaign landing page)
 */
export async function getCampaignProducts(
  tenantId: string,
  campaignId: string,
  limit: number = 50
) {
  const campaign = await db.query.saleCampaigns.findFirst({
    where: and(
      eq(saleCampaigns.id, campaignId),
      eq(saleCampaigns.tenantId, tenantId)
    ),
  });

  if (!campaign) return [];

  // Build product query based on scope
  if (campaign.scope === "store_wide") {
    return db.query.products.findMany({
      where: and(
        eq(products.tenantId, tenantId),
        eq(products.status, "active"),
        campaign.excludedProducts && campaign.excludedProducts.length > 0
          ? sql`${products.id} NOT IN (${sql.join(
              campaign.excludedProducts.map((id) => sql`${id}`),
              sql`, `
            )})`
          : undefined
      ),
      limit,
      columns: {
        id: true,
        name: true,
        slug: true,
        price: true,
      },
    });
  }

  if (campaign.scope === "categories" && campaign.eligibleCategories) {
    return db.query.products.findMany({
      where: and(
        eq(products.tenantId, tenantId),
        eq(products.status, "active"),
        inArray(products.categoryId, campaign.eligibleCategories),
        campaign.excludedProducts && campaign.excludedProducts.length > 0
          ? sql`${products.id} NOT IN (${sql.join(
              campaign.excludedProducts.map((id) => sql`${id}`),
              sql`, `
            )})`
          : undefined
      ),
      limit,
      columns: {
        id: true,
        name: true,
        slug: true,
        price: true,
      },
    });
  }

  if (campaign.scope === "products" && campaign.eligibleProducts) {
    return db.query.products.findMany({
      where: and(
        eq(products.tenantId, tenantId),
        eq(products.status, "active"),
        inArray(products.id, campaign.eligibleProducts)
      ),
      limit,
      columns: {
        id: true,
        name: true,
        slug: true,
        price: true,
      },
    });
  }

  return [];
}
