"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { storeLinks } from "@/lib/db/schema";
import { canManageStore } from "@/lib/auth/context";
import { linkSchema, type LinkInput } from "@/lib/validations/links";
import {
  generateLinkCode,
  normalizeCode,
  validateCustomCode,
} from "@/lib/links/code";
import { isLinkCodeUnique } from "@/lib/db/queries/links";

type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: { message: string; field?: string };
};

function emptyToNull(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v.length ? v : null;
}

/** Resolve the code to use: custom (validated, unique) or a fresh random one. */
async function resolveCode(
  custom: string | null | undefined,
  excludeId?: string
): Promise<{ code: string } | { error: ActionResult["error"] }> {
  if (custom && custom.trim()) {
    const code = normalizeCode(custom);
    const invalid = validateCustomCode(code);
    if (invalid) {
      return { error: { message: invalid, field: "customCode" } };
    }
    if (!(await isLinkCodeUnique(code, excludeId))) {
      return {
        error: { message: "That code is already taken", field: "customCode" },
      };
    }
    return { code };
  }

  // Auto-generate, retrying on the (extremely unlikely) collision.
  for (let i = 0; i < 6; i++) {
    const code = generateLinkCode(i < 3 ? 6 : 7);
    if (await isLinkCodeUnique(code)) return { code };
  }
  return { error: { message: "Could not generate a unique code" } };
}

function normalizeTargets(input: LinkInput) {
  return {
    productId:
      input.targetType === "product" ? (input.productId ?? null) : null,
    categoryId:
      input.targetType === "category" ? (input.categoryId ?? null) : null,
    targetUrl: input.targetType === "url" ? emptyToNull(input.targetUrl) : null,
    expiresAt: input.expiresAt ? emptyToNull(input.expiresAt) : null,
  };
}

export async function createLinkAction(
  tenantId: string,
  storeSlug: string,
  input: LinkInput
): Promise<ActionResult<{ id: string; code: string }>> {
  if (!(await canManageStore(tenantId))) {
    return { success: false, error: { message: "Unauthorized" } };
  }

  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false,
      error: { message: issue.message, field: issue.path[0]?.toString() },
    };
  }
  const data = parsed.data;

  const resolved = await resolveCode(data.customCode);
  if ("error" in resolved) {
    return { success: false, error: resolved.error };
  }

  const targets = normalizeTargets(data);

  const [created] = await db
    .insert(storeLinks)
    .values({
      tenantId,
      code: resolved.code,
      name: emptyToNull(data.name),
      targetType: data.targetType,
      productId: targets.productId,
      categoryId: targets.categoryId,
      targetUrl: targets.targetUrl,
      utmSource: emptyToNull(data.utmSource),
      utmMedium: emptyToNull(data.utmMedium),
      utmCampaign: emptyToNull(data.utmCampaign),
      utmContent: emptyToNull(data.utmContent),
      utmTerm: emptyToNull(data.utmTerm),
      expiresAt: targets.expiresAt,
      isActive: data.isActive,
    })
    .returning({ id: storeLinks.id, code: storeLinks.code });

  revalidatePath(`/dashboard/${storeSlug}/links`);
  return { success: true, data: { id: created.id, code: created.code } };
}

export async function updateLinkAction(
  tenantId: string,
  storeSlug: string,
  linkId: string,
  input: LinkInput
): Promise<ActionResult> {
  if (!(await canManageStore(tenantId))) {
    return { success: false, error: { message: "Unauthorized" } };
  }

  const existing = await db.query.storeLinks.findFirst({
    where: and(eq(storeLinks.id, linkId), eq(storeLinks.tenantId, tenantId)),
    columns: { id: true },
  });
  if (!existing) {
    return { success: false, error: { message: "Link not found" } };
  }

  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false,
      error: { message: issue.message, field: issue.path[0]?.toString() },
    };
  }
  const data = parsed.data;

  // Allow editing the custom code (kept unique, excluding this link).
  const resolved = await resolveCode(data.customCode, linkId);
  if ("error" in resolved) {
    return { success: false, error: resolved.error };
  }

  const targets = normalizeTargets(data);

  await db
    .update(storeLinks)
    .set({
      code: resolved.code,
      name: emptyToNull(data.name),
      targetType: data.targetType,
      productId: targets.productId,
      categoryId: targets.categoryId,
      targetUrl: targets.targetUrl,
      utmSource: emptyToNull(data.utmSource),
      utmMedium: emptyToNull(data.utmMedium),
      utmCampaign: emptyToNull(data.utmCampaign),
      utmContent: emptyToNull(data.utmContent),
      utmTerm: emptyToNull(data.utmTerm),
      expiresAt: targets.expiresAt,
      isActive: data.isActive,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(storeLinks.id, linkId));

  revalidatePath(`/dashboard/${storeSlug}/links`);
  revalidatePath(`/dashboard/${storeSlug}/links/${linkId}`);
  return { success: true };
}

export async function toggleLinkActiveAction(
  tenantId: string,
  storeSlug: string,
  linkId: string,
  isActive: boolean
): Promise<ActionResult> {
  if (!(await canManageStore(tenantId))) {
    return { success: false, error: { message: "Unauthorized" } };
  }

  await db
    .update(storeLinks)
    .set({ isActive, updatedAt: new Date().toISOString() })
    .where(and(eq(storeLinks.id, linkId), eq(storeLinks.tenantId, tenantId)));

  revalidatePath(`/dashboard/${storeSlug}/links`);
  return { success: true };
}

export async function deleteLinkAction(
  tenantId: string,
  storeSlug: string,
  linkId: string
): Promise<ActionResult> {
  if (!(await canManageStore(tenantId))) {
    return { success: false, error: { message: "Unauthorized" } };
  }

  await db
    .delete(storeLinks)
    .where(and(eq(storeLinks.id, linkId), eq(storeLinks.tenantId, tenantId)));

  revalidatePath(`/dashboard/${storeSlug}/links`);
  return { success: true };
}
