"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { pageLayouts, pageLayoutVersions, tenants } from "@/lib/db/schema";
import { eq, and, sql, ne } from "drizzle-orm";
import { getUser } from "@/lib/auth/server";
import { hasMinimumRole } from "@/lib/auth/context";
import { getTenantById } from "@/lib/db/queries/tenants";
import { revalidateTag, cacheTags } from "@/lib/cache";
import {
  puckDataSchema,
  pageTypeSchema,
  createPageSchema,
  updatePageMetaSchema,
  type CreatePageInput,
} from "@/lib/validations/page-builder";
import {
  searchProductsForEditor,
  getCategoriesForEditor,
  getPageLayoutVersion,
  getProductsByIds,
} from "@/lib/db/queries/page-layouts";
import type {
  PuckPageData,
  ResolvedProduct,
  ResolvedCategory,
} from "@/lib/page-builder/types";
import {
  defaultHeaderConfig,
  defaultFooterConfig,
  type HeaderConfig,
  type FooterConfig,
} from "@/lib/theme/layout-types";

type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ============================================================================
// PAGE CRUD
// ============================================================================

/**
 * Create a new page for a tenant.
 */
export async function createPage(
  tenantId: string,
  input: CreatePageInput
): Promise<ActionResult<{ id: string; slug: string }>> {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const canManage = await hasMinimumRole(tenantId, "admin");
  if (!canManage) return { success: false, error: "Insufficient permissions" };

  const result = createPageSchema.safeParse(input);
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Invalid input" };
  }

  // Check slug uniqueness
  const existing = await db.query.pageLayouts.findFirst({
    where: and(eq(pageLayouts.tenantId, tenantId), eq(pageLayouts.slug, result.data.slug)),
    columns: { id: true },
  });
  if (existing) {
    return { success: false, error: `A page with slug "${result.data.slug}" already exists` };
  }

  // Count existing pages to set displayOrder
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pageLayouts)
    .where(eq(pageLayouts.tenantId, tenantId));
  const displayOrder = (countRow?.count ?? 0);

  const [page] = await db
    .insert(pageLayouts)
    .values({
      tenantId,
      pageType: result.data.pageType,
      title: result.data.title,
      slug: result.data.slug,
      isHomepage: false,
      displayOrder,
      lastEditedBy: user.id,
    })
    .returning({ id: pageLayouts.id, slug: pageLayouts.slug });

  return { success: true, data: { id: page.id, slug: page.slug } };
}

/**
 * Update page metadata (title and/or slug).
 */
export async function updatePageMeta(
  tenantId: string,
  pageId: string,
  input: { title?: string; slug?: string }
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const canManage = await hasMinimumRole(tenantId, "admin");
  if (!canManage) return { success: false, error: "Insufficient permissions" };

  const result = updatePageMetaSchema.safeParse(input);
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Invalid input" };
  }

  // If slug is changing, check uniqueness
  if (result.data.slug) {
    const existing = await db.query.pageLayouts.findFirst({
      where: and(
        eq(pageLayouts.tenantId, tenantId),
        eq(pageLayouts.slug, result.data.slug),
        ne(pageLayouts.id, pageId)
      ),
      columns: { id: true },
    });
    if (existing) {
      return { success: false, error: `A page with slug "${result.data.slug}" already exists` };
    }
  }

  await db
    .update(pageLayouts)
    .set({
      ...(result.data.title && { title: result.data.title }),
      ...(result.data.slug && { slug: result.data.slug }),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(pageLayouts.tenantId, tenantId), eq(pageLayouts.id, pageId)));

  return { success: true };
}

/**
 * Delete a page. Cannot delete the homepage.
 */
export async function deletePage(
  tenantId: string,
  pageId: string
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const canManage = await hasMinimumRole(tenantId, "admin");
  if (!canManage) return { success: false, error: "Insufficient permissions" };

  const page = await db.query.pageLayouts.findFirst({
    where: and(eq(pageLayouts.tenantId, tenantId), eq(pageLayouts.id, pageId)),
    columns: { isHomepage: true, slug: true },
  });
  if (!page) return { success: false, error: "Page not found" };
  if (page.isHomepage) return { success: false, error: "Cannot delete the homepage" };

  await db
    .delete(pageLayouts)
    .where(and(eq(pageLayouts.tenantId, tenantId), eq(pageLayouts.id, pageId)));

  // Invalidate cache
  revalidateTag(cacheTags.layout(tenantId, page.slug));
  const tenant = await getTenantById(tenantId);
  if (tenant) revalidatePath(`/store/${tenant.slug}`);

  return { success: true };
}

/**
 * Set a page as the store homepage (clears isHomepage on all others).
 */
export async function setHomepage(
  tenantId: string,
  pageId: string
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const canManage = await hasMinimumRole(tenantId, "admin");
  if (!canManage) return { success: false, error: "Insufficient permissions" };

  const page = await db.query.pageLayouts.findFirst({
    where: and(eq(pageLayouts.tenantId, tenantId), eq(pageLayouts.id, pageId)),
    columns: { id: true },
  });
  if (!page) return { success: false, error: "Page not found" };

  // Clear existing homepage flag
  await db
    .update(pageLayouts)
    .set({ isHomepage: false })
    .where(eq(pageLayouts.tenantId, tenantId));

  // Set new homepage
  await db
    .update(pageLayouts)
    .set({ isHomepage: true, updatedAt: new Date().toISOString() })
    .where(and(eq(pageLayouts.tenantId, tenantId), eq(pageLayouts.id, pageId)));

  // Invalidate homepage layout cache
  revalidateTag(cacheTags.layout(tenantId, "homepage"));
  const tenant = await getTenantById(tenantId);
  if (tenant) revalidatePath(`/store/${tenant.slug}`);

  return { success: true };
}

/**
 * Reorder pages — accepts array of { id, displayOrder }.
 */
export async function reorderPages(
  tenantId: string,
  order: Array<{ id: string; displayOrder: number }>
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const canManage = await hasMinimumRole(tenantId, "admin");
  if (!canManage) return { success: false, error: "Insufficient permissions" };

  await Promise.all(
    order.map(({ id, displayOrder }) =>
      db
        .update(pageLayouts)
        .set({ displayOrder })
        .where(and(eq(pageLayouts.tenantId, tenantId), eq(pageLayouts.id, id)))
    )
  );

  return { success: true };
}

// ============================================================================
// EDITOR ACTIONS (save / publish / revert)
// ============================================================================

/**
 * Save the page layout draft (auto-save from editor).
 * Now keyed by pageId instead of pageType.
 */
export async function savePageLayoutDraft(
  tenantId: string,
  pageId: string,
  data: unknown
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const canManage = await hasMinimumRole(tenantId, "admin");
  if (!canManage) return { success: false, error: "Insufficient permissions" };

  const dataResult = puckDataSchema.safeParse(data);
  if (!dataResult.success) {
    return { success: false, error: "Invalid layout data" };
  }

  await db
    .update(pageLayouts)
    .set({
      draftData: dataResult.data as PuckPageData,
      lastEditedBy: user.id,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(pageLayouts.tenantId, tenantId), eq(pageLayouts.id, pageId)));

  return { success: true };
}

/**
 * Publish the layout (copies data to published_data and makes it live).
 */
export async function publishPageLayout(
  tenantId: string,
  pageId: string,
  data: unknown
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const canManage = await hasMinimumRole(tenantId, "admin");
  if (!canManage) return { success: false, error: "Insufficient permissions" };

  const dataResult = puckDataSchema.safeParse(data);
  if (!dataResult.success) {
    return { success: false, error: "Invalid layout data" };
  }

  const now = new Date().toISOString();

  // Fetch the current row to get slug, isHomepage, and current version
  const existing = await db.query.pageLayouts.findFirst({
    where: and(eq(pageLayouts.tenantId, tenantId), eq(pageLayouts.id, pageId)),
    columns: { id: true, slug: true, isHomepage: true, version: true },
  });
  if (!existing) return { success: false, error: "Page not found" };

  const [updated] = await db
    .update(pageLayouts)
    .set({
      draftData: dataResult.data as PuckPageData,
      publishedData: dataResult.data as PuckPageData,
      publishedAt: now,
      publishedBy: user.id,
      lastEditedBy: user.id,
      updatedAt: now,
      version: sql`${pageLayouts.version} + 1`,
    })
    .where(and(eq(pageLayouts.tenantId, tenantId), eq(pageLayouts.id, pageId)))
    .returning({ id: pageLayouts.id, version: pageLayouts.version });

  // Snapshot for version history
  if (updated) {
    await db.insert(pageLayoutVersions).values({
      pageLayoutId: updated.id,
      tenantId,
      data: dataResult.data as PuckPageData,
      version: updated.version,
      publishedBy: user.id,
      publishedByName: user.name || user.email || "Unknown",
    });
  }

  // Sync header/footer from homepage layout to tenant.layoutConfig
  if (existing.isHomepage) {
    await syncLayoutConfigToTenant(tenantId, dataResult.data as PuckPageData);
  }

  // Invalidate caches
  revalidateTag(cacheTags.layout(tenantId, existing.slug));
  if (existing.isHomepage) {
    revalidateTag(cacheTags.layout(tenantId, "homepage"));
  }
  const tenant = await getTenantById(tenantId);
  if (tenant) {
    revalidatePath(`/store/${tenant.slug}`);
    if (existing.slug !== "home") {
      revalidatePath(`/store/${tenant.slug}/page/${existing.slug}`);
    }
  }

  return { success: true };
}

/**
 * Extract header/footer config from Puck page data and sync to tenant.layoutConfig.
 */
async function syncLayoutConfigToTenant(tenantId: string, data: PuckPageData) {
  const content = data.content as Array<{
    type: string;
    props: Record<string, unknown>;
  }>;

  const headerSection = content.find((s) => s.type === "StoreHeader");
  const footerSection = content.find((s) => s.type === "StoreFooter");

  const layoutConfig = {
    header: headerSection
      ? { ...(headerSection.props.config as HeaderConfig), enabled: true }
      : { ...defaultHeaderConfig, enabled: false },
    footer: footerSection
      ? { ...(footerSection.props.config as FooterConfig), enabled: true }
      : { ...defaultFooterConfig, enabled: false },
  };

  const brandingUpdate: Record<string, unknown> = { layoutConfig };
  if (headerSection) {
    const hcfg = headerSection.props.config as HeaderConfig;
    if (hcfg.logoUrl) brandingUpdate.logoUrl = hcfg.logoUrl;
    if (hcfg.faviconUrl) brandingUpdate.faviconUrl = hcfg.faviconUrl;
    if (hcfg.headerDisplay) brandingUpdate.headerDisplay = hcfg.headerDisplay;
  }

  await db.update(tenants).set(brandingUpdate).where(eq(tenants.id, tenantId));
}

/**
 * Revert draft to the last published version.
 */
export async function revertToPublished(
  tenantId: string,
  pageId: string
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const canManage = await hasMinimumRole(tenantId, "admin");
  if (!canManage) return { success: false, error: "Insufficient permissions" };

  const existing = await db.query.pageLayouts.findFirst({
    where: and(eq(pageLayouts.tenantId, tenantId), eq(pageLayouts.id, pageId)),
    columns: { publishedData: true },
  });

  if (!existing?.publishedData) {
    return { success: false, error: "No published version to revert to" };
  }

  await db
    .update(pageLayouts)
    .set({
      draftData: existing.publishedData,
      lastEditedBy: user.id,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(pageLayouts.tenantId, tenantId), eq(pageLayouts.id, pageId)));

  return { success: true };
}

/**
 * Reset layout (delete custom layout data, revert to blank).
 */
export async function resetPageLayout(
  tenantId: string,
  pageId: string
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const canManage = await hasMinimumRole(tenantId, "admin");
  if (!canManage) return { success: false, error: "Insufficient permissions" };

  const page = await db.query.pageLayouts.findFirst({
    where: and(eq(pageLayouts.tenantId, tenantId), eq(pageLayouts.id, pageId)),
    columns: { slug: true },
  });
  if (!page) return { success: false, error: "Page not found" };

  await db
    .update(pageLayouts)
    .set({
      draftData: null,
      publishedData: null,
      publishedAt: null,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(pageLayouts.tenantId, tenantId), eq(pageLayouts.id, pageId)));

  revalidateTag(cacheTags.layout(tenantId, page.slug));
  const tenant = await getTenantById(tenantId);
  if (tenant) revalidatePath(`/store/${tenant.slug}`);

  return { success: true };
}

// ============================================================================
// EDITOR DATA HELPERS
// ============================================================================

export async function searchProductsAction(
  tenantId: string,
  query: string
): Promise<ActionResult<ResolvedProduct[]>> {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const canManage = await hasMinimumRole(tenantId, "admin");
  if (!canManage) return { success: false, error: "Insufficient permissions" };

  const products = await searchProductsForEditor(tenantId, query, 20);
  return { success: true, data: products };
}

export async function resolveProductsByIdsAction(
  tenantId: string,
  productIds: string[]
): Promise<ActionResult<ResolvedProduct[]>> {
  if (productIds.length === 0) return { success: true, data: [] };
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const canManage = await hasMinimumRole(tenantId, "admin");
  if (!canManage) return { success: false, error: "Insufficient permissions" };

  const products = await getProductsByIds(tenantId, productIds);
  return { success: true, data: products };
}

export async function getCategoriesAction(
  tenantId: string
): Promise<ActionResult<ResolvedCategory[]>> {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const canManage = await hasMinimumRole(tenantId, "admin");
  if (!canManage) return { success: false, error: "Insufficient permissions" };

  const cats = await getCategoriesForEditor(tenantId);
  return { success: true, data: cats };
}

/**
 * Restore a previous version as the current draft.
 */
export async function restorePageLayoutVersion(
  tenantId: string,
  pageId: string,
  versionId: string
): Promise<ActionResult<PuckPageData>> {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const canManage = await hasMinimumRole(tenantId, "admin");
  if (!canManage) return { success: false, error: "Insufficient permissions" };

  const version = await getPageLayoutVersion(versionId);
  if (!version || version.tenantId !== tenantId) {
    return { success: false, error: "Version not found" };
  }

  await db
    .update(pageLayouts)
    .set({
      draftData: version.data as PuckPageData,
      lastEditedBy: user.id,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(pageLayouts.tenantId, tenantId), eq(pageLayouts.id, pageId)));

  return { success: true, data: version.data as PuckPageData };
}

/**
 * Get version history for the editor's history panel.
 */
export async function getVersionHistory(
  tenantId: string,
  pageId: string
): Promise<
  ActionResult<
    Array<{
      id: string;
      version: number;
      publishedByName: string | null;
      label: string | null;
      createdAt: string;
    }>
  >
> {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const canManage = await hasMinimumRole(tenantId, "admin");
  if (!canManage) return { success: false, error: "Insufficient permissions" };

  const layout = await db.query.pageLayouts.findFirst({
    where: and(eq(pageLayouts.tenantId, tenantId), eq(pageLayouts.id, pageId)),
    columns: { id: true },
  });
  if (!layout) return { success: true, data: [] };

  const { getPageLayoutVersions } = await import("@/lib/db/queries/page-layouts");
  const versions = await getPageLayoutVersions(layout.id);
  return { success: true, data: versions };
}

// ============================================================================
// LEGACY COMPAT (actions that old editor code calls with pageType string)
// ============================================================================

/**
 * @deprecated Use savePageLayoutDraft(tenantId, pageId, data) instead.
 * This shim resolves a pageType to a pageId for backward compat during migration.
 */
export async function savePageLayoutDraftByType(
  tenantId: string,
  pageType: string,
  data: unknown
): Promise<ActionResult> {
  const pageResult = pageTypeSchema.safeParse(pageType);
  if (!pageResult.success) return { success: false, error: "Invalid page type" };

  // Find or create the layout row
  let layout = await db.query.pageLayouts.findFirst({
    where: and(
      eq(pageLayouts.tenantId, tenantId),
      eq(pageLayouts.slug, pageType === "homepage" ? "home" : pageType)
    ),
    columns: { id: true },
  });

  if (!layout) {
    // Create the page if it doesn't exist
    const isHomepage = pageType === "homepage";
    const [newLayout] = await db
      .insert(pageLayouts)
      .values({
        tenantId,
        pageType: pageResult.data,
        title: pageType === "homepage" ? "Home" : pageType.charAt(0).toUpperCase() + pageType.slice(1),
        slug: pageType === "homepage" ? "home" : pageType,
        isHomepage,
        displayOrder: 0,
      })
      .returning({ id: pageLayouts.id });
    layout = newLayout;
  }

  return savePageLayoutDraft(tenantId, layout.id, data);
}
