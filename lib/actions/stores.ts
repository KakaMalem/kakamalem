"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ZodError } from "zod";
import { getUser } from "@/lib/auth/server";
import {
  createStoreSchema,
  generalSettingsSchema,
  brandingSettingsSchema,
  socialLinksSchema,
  seoSettingsSchema,
  storeModeSettingsSchema,
  type CreateStoreInput,
  type StoreModeSettingsInput,
} from "@/lib/validations/stores";
import {
  checkSlugAvailable,
  createTenant,
  updateTenant,
  getTenantById,
  deleteTenant,
} from "@/lib/db/queries/tenants";
import { canAddStore } from "@/lib/db/queries/billing";
import { completeOnboardingItem } from "@/lib/db/queries/onboarding";
import { db } from "@/lib/db";
import {
  platformAffiliates,
  platformAffiliateReferrals,
  platformAffiliateClicks,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  AFFILIATE_COOKIE_NAME,
  VISITOR_ID_COOKIE_NAME,
} from "@/lib/affiliate/tracking";

export type StoreActionError = {
  message: string;
  field?: string;
};

export type StoreActionResult = {
  error?: StoreActionError;
  success?: boolean;
  storeId?: string;
  logoUrl?: string;
  faviconUrl?: string;
  ogImageUrl?: string;
};

/**
 * Track affiliate referral when a new store is created
 * Checks for affiliate cookie and creates referral record if found
 */
async function trackAffiliateReferral(tenantId: string): Promise<void> {
  try {
    const cookieStore = await cookies();
    const affiliateSlug = cookieStore.get(AFFILIATE_COOKIE_NAME)?.value;
    const visitorId = cookieStore.get(VISITOR_ID_COOKIE_NAME)?.value;

    if (!affiliateSlug) {
      return; // No affiliate cookie, nothing to track
    }

    // Find the affiliate by slug
    const affiliate = await db.query.platformAffiliates.findFirst({
      where: and(
        eq(platformAffiliates.slug, affiliateSlug.toLowerCase()),
        eq(platformAffiliates.status, "approved")
      ),
      columns: {
        id: true,
        currentCommissionRate: true,
      },
    });

    if (!affiliate) {
      return; // Affiliate not found or not approved
    }

    // Check if referral already exists for this tenant (prevent duplicates)
    const existingReferral =
      await db.query.platformAffiliateReferrals.findFirst({
        where: eq(platformAffiliateReferrals.tenantId, tenantId),
        columns: { id: true },
      });

    if (existingReferral) {
      return; // Referral already exists
    }

    // Find the click record to link (if visitor ID exists)
    let clickId: string | null = null;
    if (visitorId) {
      const click = await db.query.platformAffiliateClicks.findFirst({
        where: and(
          eq(platformAffiliateClicks.affiliateId, affiliate.id),
          eq(platformAffiliateClicks.visitorId, visitorId),
          eq(platformAffiliateClicks.converted, false)
        ),
        columns: { id: true },
        orderBy: (clicks, { desc }) => [desc(clicks.clickedAt)],
      });
      clickId = click?.id ?? null;
    }

    // Create the referral record
    await db.insert(platformAffiliateReferrals).values({
      affiliateId: affiliate.id,
      tenantId: tenantId,
      clickId: clickId,
      commissionRate: affiliate.currentCommissionRate.toString(),
      status: "trial", // New stores start in trial
    });

    // Update the click to mark as converted (if we found one)
    if (clickId) {
      await db
        .update(platformAffiliateClicks)
        .set({
          converted: true,
          convertedAt: new Date().toISOString(),
        })
        .where(eq(platformAffiliateClicks.id, clickId));
    }

    // Increment affiliate's total signups
    await db
      .update(platformAffiliates)
      .set({
        totalSignups: sql`${platformAffiliates.totalSignups} + 1`,
      })
      .where(eq(platformAffiliates.id, affiliate.id));

    console.log(
      `[Affiliate] Referral created: affiliate=${affiliateSlug}, tenant=${tenantId}`
    );
  } catch (error) {
    // Log but don't fail store creation if affiliate tracking fails
    console.error("[Affiliate] Failed to track referral:", error);
  }
}

/**
 * Helper to upload a branding image to local storage
 */
async function uploadBrandingImage(
  tenantId: string,
  file: File,
  type: "logo" | "favicon" | "og-image"
): Promise<string | null> {
  try {
    const { uploadFile } = await import("@/lib/storage");

    // Convert File to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to local storage
    const result = await uploadFile(buffer, file.name, file.type, {
      tenantId,
      folder: "branding",
      generateUniqueName: true,
      processImage: true,
      convertToWebp: type !== "favicon", // Keep favicon as PNG/ICO
    });

    if (!result.success) {
      console.error("Branding image upload error:", result.error);
      return null;
    }

    return result.url;
  } catch (error) {
    console.error("Branding image upload error:", error);
    return null;
  }
}

/**
 * Create a new store
 */
export async function createStore(
  formData: FormData
): Promise<StoreActionResult> {
  const user = await getUser();

  if (!user) {
    return { error: { message: "You must be logged in to create a store" } };
  }

  // Check store limit before creating
  const limitCheck = await canAddStore(user.id);
  if (!limitCheck.allowed) {
    return {
      error: { message: limitCheck.reason || "Cannot create more stores" },
    };
  }

  const formValues: CreateStoreInput = {
    storeMode:
      (formData.get("storeMode") as
        | "full"
        | "online_only"
        | "offline_only"
        | "catalog") || "full",
    name: formData.get("name") as string,
    slug: formData.get("slug") as string,
    tagline: (formData.get("tagline") as string) || undefined,
    logoUrl: (formData.get("logoUrl") as string) || undefined,
    headerDisplay:
      (formData.get("headerDisplay") as
        | "logo_only"
        | "name_only"
        | "logo_and_name") || "name_only",
    contactEmail: (formData.get("contactEmail") as string) || undefined,
    contactPhone: (formData.get("contactPhone") as string) || undefined,
    currency: (formData.get("currency") as "AFN" | "USD") || "AFN",
  };

  // Server-side validation
  try {
    createStoreSchema.parse(formValues);
  } catch (err) {
    if (err instanceof ZodError) {
      const firstError = err.issues[0];
      return {
        error: {
          message: firstError?.message || "Validation failed",
          field: firstError?.path[0] as string,
        },
      };
    }
  }

  // Check slug availability
  const slugAvailable = await checkSlugAvailable(formValues.slug);
  if (!slugAvailable) {
    return {
      error: {
        message: "This store URL is already taken. Please choose another.",
        field: "slug",
      },
    };
  }

  // Create the store
  try {
    const newStore = await createTenant({
      name: formValues.name,
      slug: formValues.slug,
      ownerId: user.id,
      tagline: formValues.tagline,
      logoUrl: formValues.logoUrl,
      headerDisplay: formValues.headerDisplay,
      contactEmail: formValues.contactEmail,
      contactPhone: formValues.contactPhone,
      currency: formValues.currency,
    });

    if (!newStore) {
      return {
        error: { message: "Failed to create store. Please try again." },
      };
    }

    // Track affiliate referral (if user came from affiliate link)
    await trackAffiliateReferral(newStore.id);

    revalidatePath("/dashboard", "layout");
    return { success: true, storeId: newStore.id };
  } catch {
    return {
      error: { message: "An unexpected error occurred. Please try again." },
    };
  }
}

/**
 * Create a new store with optional logo upload
 */
export async function createStoreWithLogo(
  formValues: CreateStoreInput,
  logoFile: File | null
): Promise<StoreActionResult> {
  const user = await getUser();

  if (!user) {
    return { error: { message: "You must be logged in to create a store" } };
  }

  // Check store limit before creating
  const limitCheck = await canAddStore(user.id);
  if (!limitCheck.allowed) {
    return {
      error: { message: limitCheck.reason || "Cannot create more stores" },
    };
  }

  // Server-side validation
  try {
    createStoreSchema.parse(formValues);
  } catch (err) {
    if (err instanceof ZodError) {
      const firstError = err.issues[0];
      return {
        error: {
          message: firstError?.message || "Validation failed",
          field: firstError?.path[0] as string,
        },
      };
    }
  }

  // Check slug availability
  const slugAvailable = await checkSlugAvailable(formValues.slug);
  if (!slugAvailable) {
    return {
      error: {
        message: "This store URL is already taken. Please choose another.",
        field: "slug",
      },
    };
  }

  // Create the store first to get an ID for the logo upload
  try {
    const newStore = await createTenant({
      name: formValues.name,
      slug: formValues.slug,
      ownerId: user.id,
      tagline: formValues.tagline,
      headerDisplay: formValues.headerDisplay,
      contactEmail: formValues.contactEmail,
      contactPhone: formValues.contactPhone,
      currency: formValues.currency,
      storeMode: formValues.storeMode,
      // Store location
      storeLocationLat: formValues.storeLocationLat ?? null,
      storeLocationLng: formValues.storeLocationLng ?? null,
      storeLocationCity: formValues.storeLocationCity || null,
      storeLocationAccuracy: formValues.storeLocationAccuracy ?? null,
      storeLocationSource: formValues.storeLocationSource ?? null,
      storeLocationPlusCode: formValues.storeLocationPlusCode || null,
    });

    if (!newStore) {
      return {
        error: { message: "Failed to create store. Please try again." },
      };
    }

    // Track affiliate referral (if user came from affiliate link)
    await trackAffiliateReferral(newStore.id);

    // Upload logo if provided
    let logoUrl: string | null = null;
    if (logoFile) {
      logoUrl = await uploadBrandingImage(newStore.id, logoFile, "logo");
      if (logoUrl) {
        // Update store with logo URL
        await updateTenant(newStore.id, { logoUrl });
      }
    }

    // Create onboarding checklist for the new store
    try {
      const { createOnboardingChecklist } =
        await import("@/lib/db/queries/onboarding");
      await createOnboardingChecklist(
        newStore.id,
        formValues.slug,
        formValues.storeMode || "full"
      );
    } catch (checklistError) {
      // Log but don't fail store creation if checklist fails
      console.error("Failed to create onboarding checklist:", checklistError);
    }

    revalidatePath("/dashboard", "layout");
    return {
      success: true,
      storeId: newStore.id,
      logoUrl: logoUrl || undefined,
    };
  } catch {
    return {
      error: { message: "An unexpected error occurred. Please try again." },
    };
  }
}

/**
 * Check if a slug is available (for real-time validation)
 */
export async function checkSlugAvailability(slug: string): Promise<boolean> {
  if (!slug || slug.length < 3) return false;
  return checkSlugAvailable(slug);
}

/**
 * Update general store settings
 */
export async function updateGeneralSettings(
  storeId: string,
  formData: FormData
): Promise<StoreActionResult> {
  const user = await getUser();

  if (!user) {
    return { error: { message: "You must be logged in" } };
  }

  // Verify ownership
  const store = await getTenantById(storeId);
  if (!store || store.ownerId !== user.id) {
    return {
      error: { message: "You don't have permission to update this store" },
    };
  }

  const formValues = {
    name: formData.get("name") as string,
    tagline: (formData.get("tagline") as string) || "",
    description: (formData.get("description") as string) || "",
    contactEmail: (formData.get("contactEmail") as string) || "",
    contactPhone: (formData.get("contactPhone") as string) || "",
    currency: (formData.get("currency") as "AFN" | "USD") || "AFN",
  };

  try {
    generalSettingsSchema.parse(formValues);
  } catch (err) {
    if (err instanceof ZodError) {
      const firstError = err.issues[0];
      return {
        error: {
          message: firstError?.message || "Validation failed",
          field: firstError?.path[0] as string,
        },
      };
    }
  }

  try {
    await updateTenant(storeId, {
      name: formValues.name,
      tagline: formValues.tagline || null,
      description: formValues.description || null,
      contactEmail: formValues.contactEmail || null,
      contactPhone: formValues.contactPhone || null,
      currency: formValues.currency,
    });

    // Mark onboarding item as complete (async, don't block)
    completeOnboardingItem(storeId, "customize_store").catch(() => {
      // Silently ignore - onboarding completion is not critical
    });

    revalidatePath("/dashboard/settings", "page");
    return { success: true };
  } catch {
    return {
      error: { message: "Failed to update settings. Please try again." },
    };
  }
}

/**
 * Update branding settings
 */
export async function updateBrandingSettings(
  storeId: string,
  formData: FormData
): Promise<StoreActionResult> {
  const user = await getUser();

  if (!user) {
    return { error: { message: "You must be logged in" } };
  }

  const store = await getTenantById(storeId);
  if (!store || store.ownerId !== user.id) {
    return {
      error: { message: "You don't have permission to update this store" },
    };
  }

  const formValues = {
    logoUrl: (formData.get("logoUrl") as string) || "",
    faviconUrl: (formData.get("faviconUrl") as string) || "",
    headerDisplay:
      (formData.get("headerDisplay") as
        | "logo_only"
        | "name_only"
        | "logo_and_name") || "logo_and_name",
  };

  try {
    brandingSettingsSchema.parse(formValues);
  } catch (err) {
    if (err instanceof ZodError) {
      const firstError = err.issues[0];
      return {
        error: {
          message: firstError?.message || "Validation failed",
          field: firstError?.path[0] as string,
        },
      };
    }
  }

  try {
    await updateTenant(storeId, {
      logoUrl: formValues.logoUrl || null,
      faviconUrl: formValues.faviconUrl || null,
      headerDisplay: formValues.headerDisplay,
    });

    revalidatePath("/dashboard/settings/branding", "page");
    return { success: true };
  } catch {
    return {
      error: { message: "Failed to update branding. Please try again." },
    };
  }
}

/**
 * Update branding settings with optional image file uploads
 */
export async function updateBrandingSettingsWithImages(
  storeId: string,
  formValues: {
    logoUrl: string;
    faviconUrl: string;
    headerDisplay: "logo_only" | "name_only" | "logo_and_name";
  },
  logoFile: File | null,
  faviconFile: File | null
): Promise<StoreActionResult> {
  const user = await getUser();

  if (!user) {
    return { error: { message: "You must be logged in" } };
  }

  const store = await getTenantById(storeId);
  if (!store || store.ownerId !== user.id) {
    return {
      error: { message: "You don't have permission to update this store" },
    };
  }

  try {
    brandingSettingsSchema.parse(formValues);
  } catch (err) {
    if (err instanceof ZodError) {
      const firstError = err.issues[0];
      return {
        error: {
          message: firstError?.message || "Validation failed",
          field: firstError?.path[0] as string,
        },
      };
    }
  }

  let logoUrl = formValues.logoUrl || null;
  let faviconUrl = formValues.faviconUrl || null;

  // Upload logo if provided
  if (logoFile) {
    const uploadedUrl = await uploadBrandingImage(storeId, logoFile, "logo");
    if (uploadedUrl) {
      logoUrl = uploadedUrl;
    } else {
      return { error: { message: "Failed to upload logo. Please try again." } };
    }
  }

  // Upload favicon if provided
  if (faviconFile) {
    const uploadedUrl = await uploadBrandingImage(
      storeId,
      faviconFile,
      "favicon"
    );
    if (uploadedUrl) {
      faviconUrl = uploadedUrl;
    } else {
      return {
        error: { message: "Failed to upload favicon. Please try again." },
      };
    }
  }

  try {
    await updateTenant(storeId, {
      logoUrl,
      faviconUrl,
      headerDisplay: formValues.headerDisplay,
    });

    revalidatePath("/dashboard/settings/branding", "page");
    return {
      success: true,
      logoUrl: logoUrl || undefined,
      faviconUrl: faviconUrl || undefined,
    };
  } catch {
    return {
      error: { message: "Failed to update branding. Please try again." },
    };
  }
}

/**
 * Update social links
 */
export async function updateSocialLinks(
  storeId: string,
  formData: FormData
): Promise<StoreActionResult> {
  const user = await getUser();

  if (!user) {
    return { error: { message: "You must be logged in" } };
  }

  const store = await getTenantById(storeId);
  if (!store || store.ownerId !== user.id) {
    return {
      error: { message: "You don't have permission to update this store" },
    };
  }

  const formValues = {
    facebook: (formData.get("facebook") as string) || "",
    instagram: (formData.get("instagram") as string) || "",
    twitter: (formData.get("twitter") as string) || "",
    whatsapp: (formData.get("whatsapp") as string) || "",
    telegram: (formData.get("telegram") as string) || "",
    tiktok: (formData.get("tiktok") as string) || "",
    youtube: (formData.get("youtube") as string) || "",
    preferredContactMethod:
      (formData.get("preferredContactMethod") as string) || "whatsapp",
    showWhatsAppButton: formData.get("showWhatsAppButton") === "true",
  };

  try {
    socialLinksSchema.parse(formValues);
  } catch (err) {
    if (err instanceof ZodError) {
      const firstError = err.issues[0];
      return {
        error: {
          message: firstError?.message || "Validation failed",
          field: firstError?.path[0] as string,
        },
      };
    }
  }

  // Clean up empty strings to undefined for JSONB storage
  const socialLinks = {
    facebook: formValues.facebook || undefined,
    instagram: formValues.instagram || undefined,
    twitter: formValues.twitter || undefined,
    whatsapp: formValues.whatsapp || undefined,
    telegram: formValues.telegram || undefined,
    tiktok: formValues.tiktok || undefined,
    youtube: formValues.youtube || undefined,
    preferredContactMethod: formValues.preferredContactMethod as
      | "phone"
      | "whatsapp"
      | "both",
    showWhatsAppButton: formValues.showWhatsAppButton,
  };

  try {
    await updateTenant(storeId, { socialLinks });

    // Mark onboarding item as complete (async, don't block)
    // This completes "add_contact" for catalog mode stores
    completeOnboardingItem(storeId, "add_contact").catch(() => {
      // Silently ignore - onboarding completion is not critical
    });

    revalidatePath("/dashboard/settings/social", "page");
    return { success: true };
  } catch {
    return {
      error: { message: "Failed to update social links. Please try again." },
    };
  }
}

/**
 * Update SEO settings
 */
export async function updateSeoSettings(
  storeId: string,
  formData: FormData
): Promise<StoreActionResult> {
  const user = await getUser();

  if (!user) {
    return { error: { message: "You must be logged in" } };
  }

  const store = await getTenantById(storeId);
  if (!store || store.ownerId !== user.id) {
    return {
      error: { message: "You don't have permission to update this store" },
    };
  }

  const formValues = {
    metaTitle: (formData.get("metaTitle") as string) || "",
    metaDescription: (formData.get("metaDescription") as string) || "",
    ogImageUrl: (formData.get("ogImageUrl") as string) || "",
  };

  try {
    seoSettingsSchema.parse(formValues);
  } catch (err) {
    if (err instanceof ZodError) {
      const firstError = err.issues[0];
      return {
        error: {
          message: firstError?.message || "Validation failed",
          field: firstError?.path[0] as string,
        },
      };
    }
  }

  const seo = {
    metaTitle: formValues.metaTitle || undefined,
    metaDescription: formValues.metaDescription || undefined,
    ogImageUrl: formValues.ogImageUrl || undefined,
  };

  try {
    await updateTenant(storeId, { seo });

    revalidatePath("/dashboard/settings/seo", "page");
    return { success: true };
  } catch {
    return {
      error: { message: "Failed to update SEO settings. Please try again." },
    };
  }
}

/**
 * Update SEO settings with optional OG image file upload
 */
export async function updateSeoSettingsWithImage(
  storeId: string,
  formValues: {
    metaTitle: string;
    metaDescription: string;
    ogImageUrl: string;
  },
  ogImageFile: File | null
): Promise<StoreActionResult> {
  const user = await getUser();

  if (!user) {
    return { error: { message: "You must be logged in" } };
  }

  const store = await getTenantById(storeId);
  if (!store || store.ownerId !== user.id) {
    return {
      error: { message: "You don't have permission to update this store" },
    };
  }

  try {
    seoSettingsSchema.parse(formValues);
  } catch (err) {
    if (err instanceof ZodError) {
      const firstError = err.issues[0];
      return {
        error: {
          message: firstError?.message || "Validation failed",
          field: firstError?.path[0] as string,
        },
      };
    }
  }

  let ogImageUrl = formValues.ogImageUrl || undefined;

  // Upload OG image if provided
  if (ogImageFile) {
    const uploadedUrl = await uploadBrandingImage(
      storeId,
      ogImageFile,
      "og-image"
    );
    if (uploadedUrl) {
      ogImageUrl = uploadedUrl;
    } else {
      return {
        error: { message: "Failed to upload OG image. Please try again." },
      };
    }
  }

  const seo = {
    metaTitle: formValues.metaTitle || undefined,
    metaDescription: formValues.metaDescription || undefined,
    ogImageUrl,
  };

  try {
    await updateTenant(storeId, { seo });

    revalidatePath("/dashboard/settings/seo", "page");
    return { success: true, ogImageUrl };
  } catch {
    return {
      error: { message: "Failed to update SEO settings. Please try again." },
    };
  }
}

/**
 * Deactivate a store (set status to inactive)
 */
export async function deactivateStore(
  storeId: string
): Promise<StoreActionResult> {
  const user = await getUser();

  if (!user) {
    return { error: { message: "You must be logged in" } };
  }

  const store = await getTenantById(storeId);
  if (!store || store.ownerId !== user.id) {
    return {
      error: { message: "You don't have permission to deactivate this store" },
    };
  }

  try {
    await updateTenant(storeId, { status: "inactive" });

    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch {
    return {
      error: { message: "Failed to deactivate store. Please try again." },
    };
  }
}

/**
 * Reactivate a store (set status to active)
 */
export async function reactivateStore(
  storeId: string
): Promise<StoreActionResult> {
  const user = await getUser();

  if (!user) {
    return { error: { message: "You must be logged in" } };
  }

  const store = await getTenantById(storeId);
  if (!store || store.ownerId !== user.id) {
    return {
      error: { message: "You don't have permission to reactivate this store" },
    };
  }

  try {
    await updateTenant(storeId, { status: "active" });

    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch {
    return {
      error: { message: "Failed to reactivate store. Please try again." },
    };
  }
}

/**
 * Permanently delete a store and all its data
 */
export async function deleteStoreAction(
  storeId: string,
  confirmationName: string
): Promise<StoreActionResult> {
  const user = await getUser();

  if (!user) {
    return { error: { message: "You must be logged in" } };
  }

  const store = await getTenantById(storeId);
  if (!store || store.ownerId !== user.id) {
    return {
      error: { message: "You don't have permission to delete this store" },
    };
  }

  // Verify the confirmation matches the store name
  if (confirmationName !== store.name) {
    return {
      error: {
        message: "Store name doesn't match. Please type the exact store name.",
        field: "confirmationName",
      },
    };
  }

  try {
    // Delete from database - cascade will handle related records
    await deleteTenant(storeId);

    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch {
    return {
      error: { message: "Failed to delete store. Please try again." },
    };
  }
}

// Keep old name for backwards compatibility
export const deleteStore = deleteStoreAction;

/**
 * Update delivery mode setting
 */
export async function updateDeliveryMode(
  storeId: string,
  deliveryMode: "distance_based" | "service_level" | "weight_price_based"
): Promise<StoreActionResult> {
  const user = await getUser();

  if (!user) {
    return { error: { message: "You must be logged in" } };
  }

  const store = await getTenantById(storeId);
  if (!store || store.ownerId !== user.id) {
    return {
      error: { message: "You don't have permission to update this store" },
    };
  }

  const validModes = ["distance_based", "service_level", "weight_price_based"];
  if (!validModes.includes(deliveryMode)) {
    return { error: { message: "Invalid delivery mode" } };
  }

  try {
    await updateTenant(storeId, { deliveryMode });

    revalidatePath("/dashboard/settings/delivery", "page");
    return { success: true };
  } catch {
    return {
      error: { message: "Failed to update delivery mode. Please try again." },
    };
  }
}

/**
 * Update delivery zones enabled setting
 * When enabled, customers must be within a configured delivery zone to place orders
 * @deprecated Use updateFulfillmentSettings instead for the additive model
 */
export async function updateDeliveryZonesEnabled(
  storeId: string,
  storeSlug: string,
  enabled: boolean
): Promise<StoreActionResult> {
  const user = await getUser();

  if (!user) {
    return { error: { message: "You must be logged in" } };
  }

  const store = await getTenantById(storeId);
  if (!store || store.ownerId !== user.id) {
    return {
      error: { message: "You don't have permission to update this store" },
    };
  }

  try {
    await updateTenant(storeId, { enableDeliveryZones: enabled });

    // Revalidate the delivery settings page and store pages
    revalidatePath(`/dashboard/${storeSlug}/settings/delivery`, "page");
    revalidatePath(`/store/${storeSlug}`, "layout");
    return { success: true };
  } catch {
    return {
      error: {
        message: "Failed to update delivery zone settings. Please try again.",
      },
    };
  }
}

/**
 * Fulfillment settings input type
 */
export type FulfillmentSettingsInput = {
  enableDeliveryZones: boolean;
  enableShipping: boolean;
};

/**
 * Update fulfillment settings (additive model)
 * Both local delivery zones and shipping can be enabled simultaneously
 * - enableDeliveryZones: GPS-based delivery for local customers
 * - enableShipping: Shipping rates for remote customers
 */
export async function updateFulfillmentSettings(
  storeId: string,
  storeSlug: string,
  settings: FulfillmentSettingsInput
): Promise<StoreActionResult> {
  const user = await getUser();

  if (!user) {
    return { error: { message: "You must be logged in" } };
  }

  const store = await getTenantById(storeId);
  if (!store || store.ownerId !== user.id) {
    return {
      error: { message: "You don't have permission to update this store" },
    };
  }

  // Validate that at least one fulfillment method is enabled
  if (!settings.enableDeliveryZones && !settings.enableShipping) {
    return {
      error: {
        message:
          "At least one fulfillment method must be enabled. Enable either Local Delivery, Shipping, or both.",
      },
    };
  }

  try {
    await updateTenant(storeId, {
      enableDeliveryZones: settings.enableDeliveryZones,
      enableShipping: settings.enableShipping,
    });

    // Revalidate relevant pages
    revalidatePath(`/dashboard/${storeSlug}/settings/delivery`, "page");
    revalidatePath(`/store/${storeSlug}`, "layout");
    revalidatePath(`/store/${storeSlug}/checkout`, "page");

    return { success: true };
  } catch {
    return {
      error: {
        message: "Failed to update fulfillment settings. Please try again.",
      },
    };
  }
}

/**
 * Update store mode settings
 * Controls how the store operates: full commerce, online only, offline only, or catalog
 */
export async function updateStoreModeSettings(
  storeId: string,
  storeSlug: string,
  settings: StoreModeSettingsInput
): Promise<StoreActionResult> {
  const user = await getUser();

  if (!user) {
    return { error: { message: "You must be logged in" } };
  }

  const store = await getTenantById(storeId);
  if (!store || store.ownerId !== user.id) {
    return {
      error: { message: "You don't have permission to update this store" },
    };
  }

  try {
    storeModeSettingsSchema.parse(settings);
  } catch (err) {
    if (err instanceof ZodError) {
      const firstError = err.issues[0];
      return {
        error: {
          message: firstError?.message || "Validation failed",
          field: firstError?.path[0] as string,
        },
      };
    }
  }

  // Apply store mode presets with channel overrides
  let onlineCheckoutEnabled = settings.onlineCheckoutEnabled;
  let posEnabled = settings.posEnabled;

  // Store mode determines the defaults, but toggles can override
  switch (settings.storeMode) {
    case "online_only":
      posEnabled = false;
      break;
    case "offline_only":
      onlineCheckoutEnabled = false;
      break;
    case "catalog":
      onlineCheckoutEnabled = false;
      posEnabled = false;
      break;
    // "full" mode respects all toggles
  }

  try {
    await updateTenant(storeId, {
      storeMode: settings.storeMode,
      onlineCheckoutEnabled,
      posEnabled,
      // POS settings
      posScannerMode: settings.posScannerMode,
      // Receipt settings
      receiptPaperWidth: settings.receiptPaperWidth,
      receiptShowLogo: settings.receiptShowLogo,
      receiptShowContact: settings.receiptShowContact,
      receiptFooterText: settings.receiptFooterText || null,
      receiptPrintMode: settings.receiptPrintMode,
    });

    // Revalidate dashboard and store pages
    revalidatePath(`/dashboard/${storeSlug}`, "layout");
    revalidatePath(`/store/${storeSlug}`, "layout");
    return { success: true };
  } catch {
    return {
      error: {
        message: "Failed to update store mode. Please try again.",
      },
    };
  }
}

/**
 * Update store location settings
 */
export async function updateStoreLocation(
  storeId: string,
  storeSlug: string,
  locationData: {
    storeLocationLat: number | null;
    storeLocationLng: number | null;
    storeLocationCity: string | null;
    storeLocationPlusCode: string | null;
    storeLocationAccuracy: number | null;
    storeLocationSource: "gps" | "manual" | null;
  }
): Promise<StoreActionResult> {
  const user = await getUser();

  if (!user) {
    return { error: { message: "You must be logged in" } };
  }

  const store = await getTenantById(storeId);
  if (!store || store.ownerId !== user.id) {
    return {
      error: { message: "You don't have permission to update this store" },
    };
  }

  try {
    await updateTenant(storeId, {
      storeLocationLat: locationData.storeLocationLat?.toString() ?? null,
      storeLocationLng: locationData.storeLocationLng?.toString() ?? null,
      storeLocationCity: locationData.storeLocationCity,
      storeLocationPlusCode: locationData.storeLocationPlusCode,
      storeLocationAccuracy: locationData.storeLocationAccuracy,
      storeLocationSource: locationData.storeLocationSource,
    });

    revalidatePath(`/dashboard/${storeSlug}/settings/location`, "page");
    revalidatePath(`/store/${storeSlug}`, "layout");
    return { success: true };
  } catch {
    return {
      error: {
        message: "Failed to update store location. Please try again.",
      },
    };
  }
}
