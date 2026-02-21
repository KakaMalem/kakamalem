"use server";

import { revalidatePath } from "next/cache";
import { revalidateTag, cacheTags } from "@/lib/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { saleCampaigns } from "@/lib/db/schema";
import { getUser, hasStoreAccess } from "@/lib/auth/server";
import {
  campaignSchema,
  type CampaignInput,
} from "@/lib/validations/campaigns";
import { isCampaignSlugUnique } from "@/lib/db/queries/campaigns";

// =============================================================================
// TYPES
// =============================================================================

type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    field?: string;
  };
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a slug from campaign name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

// =============================================================================
// CRUD ACTIONS
// =============================================================================

/**
 * Create a new sale campaign
 */
export async function createCampaignAction(
  tenantId: string,
  storeSlug: string,
  input: CampaignInput
): Promise<ActionResult<{ id: string }>> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: { message: "Unauthorized" } };
  }

  const access = await hasStoreAccess(tenantId);
  if (!access || access.role === "staff") {
    return { success: false, error: { message: "Unauthorized" } };
  }

  // Validate input
  const validation = campaignSchema.safeParse(input);
  if (!validation.success) {
    const issue = validation.error.issues[0];
    return {
      success: false,
      error: {
        message: issue.message,
        field: issue.path[0] as string,
      },
    };
  }

  const data = validation.data;

  // Generate or validate slug
  let slug = data.slug;
  if (!slug) {
    slug = generateSlug(data.name);
  }

  // Check slug uniqueness
  if (slug) {
    const isUnique = await isCampaignSlugUnique(tenantId, slug);
    if (!isUnique) {
      // Append random suffix
      slug = `${slug}-${Date.now().toString(36)}`;
    }
  }

  // Insert campaign
  const [newCampaign] = await db
    .insert(saleCampaigns)
    .values({
      tenantId,
      name: data.name,
      description: data.description || null,
      slug,
      discountType: data.discountType,
      discountValue: data.discountValue,
      scope: data.scope,
      eligibleCategories:
        data.scope === "categories" && data.eligibleCategories?.length
          ? data.eligibleCategories
          : null,
      eligibleProducts:
        data.scope === "products" && data.eligibleProducts?.length
          ? data.eligibleProducts
          : null,
      excludedProducts: data.excludedProducts?.length
        ? data.excludedProducts
        : null,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      minimumOrderAmount: data.minimumOrderAmount || null,
      showBadge: data.showBadge,
      badgeText: data.badgeText || null,
      bannerImage: data.bannerImage || null,
      isActive: data.isActive,
      priority: data.priority,
    })
    .returning({ id: saleCampaigns.id });

  revalidateTag(cacheTags.campaigns(tenantId));
  revalidatePath(`/dashboard/${storeSlug}/campaigns`);
  return { success: true, data: { id: newCampaign.id } };
}

/**
 * Update an existing campaign
 */
export async function updateCampaignAction(
  tenantId: string,
  storeSlug: string,
  campaignId: string,
  input: CampaignInput
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: { message: "Unauthorized" } };
  }

  const access = await hasStoreAccess(tenantId);
  if (!access || access.role === "staff") {
    return { success: false, error: { message: "Unauthorized" } };
  }

  // Validate input
  const validation = campaignSchema.safeParse(input);
  if (!validation.success) {
    const issue = validation.error.issues[0];
    return {
      success: false,
      error: {
        message: issue.message,
        field: issue.path[0] as string,
      },
    };
  }

  const data = validation.data;

  // Generate or validate slug
  let slug = data.slug;
  if (!slug) {
    slug = generateSlug(data.name);
  }

  // Check slug uniqueness (excluding current campaign)
  if (slug) {
    const isUnique = await isCampaignSlugUnique(tenantId, slug, campaignId);
    if (!isUnique) {
      return {
        success: false,
        error: {
          message: "A campaign with this slug already exists",
          field: "slug",
        },
      };
    }
  }

  // Update campaign
  await db
    .update(saleCampaigns)
    .set({
      name: data.name,
      description: data.description || null,
      slug,
      discountType: data.discountType,
      discountValue: data.discountValue,
      scope: data.scope,
      eligibleCategories:
        data.scope === "categories" && data.eligibleCategories?.length
          ? data.eligibleCategories
          : null,
      eligibleProducts:
        data.scope === "products" && data.eligibleProducts?.length
          ? data.eligibleProducts
          : null,
      excludedProducts: data.excludedProducts?.length
        ? data.excludedProducts
        : null,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      minimumOrderAmount: data.minimumOrderAmount || null,
      showBadge: data.showBadge,
      badgeText: data.badgeText || null,
      bannerImage: data.bannerImage || null,
      isActive: data.isActive,
      priority: data.priority,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(saleCampaigns.id, campaignId),
        eq(saleCampaigns.tenantId, tenantId)
      )
    );

  revalidateTag(cacheTags.campaigns(tenantId));
  revalidatePath(`/dashboard/${storeSlug}/campaigns`);
  revalidatePath(`/dashboard/${storeSlug}/campaigns/${campaignId}`);
  return { success: true };
}

/**
 * Delete a campaign
 */
export async function deleteCampaignAction(
  tenantId: string,
  storeSlug: string,
  campaignId: string
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: { message: "Unauthorized" } };
  }

  const access = await hasStoreAccess(tenantId);
  if (!access || access.role === "staff") {
    return { success: false, error: { message: "Unauthorized" } };
  }

  // Hard delete (campaigns are time-limited anyway)
  await db
    .delete(saleCampaigns)
    .where(
      and(
        eq(saleCampaigns.id, campaignId),
        eq(saleCampaigns.tenantId, tenantId)
      )
    );

  revalidateTag(cacheTags.campaigns(tenantId));
  revalidatePath(`/dashboard/${storeSlug}/campaigns`);
  return { success: true };
}

/**
 * Toggle campaign active status
 */
export async function toggleCampaignStatusAction(
  tenantId: string,
  storeSlug: string,
  campaignId: string,
  isActive: boolean
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: { message: "Unauthorized" } };
  }

  const access = await hasStoreAccess(tenantId);
  if (!access || access.role === "staff") {
    return { success: false, error: { message: "Unauthorized" } };
  }

  await db
    .update(saleCampaigns)
    .set({
      isActive,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(saleCampaigns.id, campaignId),
        eq(saleCampaigns.tenantId, tenantId)
      )
    );

  revalidateTag(cacheTags.campaigns(tenantId));
  revalidatePath(`/dashboard/${storeSlug}/campaigns`);
  return { success: true };
}

/**
 * Duplicate a campaign
 */
export async function duplicateCampaignAction(
  tenantId: string,
  storeSlug: string,
  campaignId: string
): Promise<ActionResult<{ id: string }>> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: { message: "Unauthorized" } };
  }

  const access = await hasStoreAccess(tenantId);
  if (!access || access.role === "staff") {
    return { success: false, error: { message: "Unauthorized" } };
  }

  // Get the original campaign
  const original = await db.query.saleCampaigns.findFirst({
    where: and(
      eq(saleCampaigns.id, campaignId),
      eq(saleCampaigns.tenantId, tenantId)
    ),
  });

  if (!original) {
    return { success: false, error: { message: "Campaign not found" } };
  }

  // Generate new name and slug
  const newName = `${original.name} (Copy)`;
  let newSlug = original.slug ? `${original.slug}-copy` : generateSlug(newName);

  // Ensure slug is unique
  const isUnique = await isCampaignSlugUnique(tenantId, newSlug);
  if (!isUnique) {
    newSlug = `${newSlug}-${Date.now().toString(36)}`;
  }

  // Create duplicate (inactive by default)
  const [newCampaign] = await db
    .insert(saleCampaigns)
    .values({
      tenantId,
      name: newName,
      description: original.description,
      slug: newSlug,
      discountType: original.discountType,
      discountValue: original.discountValue,
      scope: original.scope,
      eligibleCategories: original.eligibleCategories,
      eligibleProducts: original.eligibleProducts,
      excludedProducts: original.excludedProducts,
      startsAt: original.startsAt,
      endsAt: original.endsAt,
      minimumOrderAmount: original.minimumOrderAmount,
      showBadge: original.showBadge,
      badgeText: original.badgeText,
      bannerImage: original.bannerImage,
      isActive: false, // Start inactive
      priority: original.priority,
    })
    .returning({ id: saleCampaigns.id });

  revalidateTag(cacheTags.campaigns(tenantId));
  revalidatePath(`/dashboard/${storeSlug}/campaigns`);
  return { success: true, data: { id: newCampaign.id } };
}
