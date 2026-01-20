import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  onboardingChecklists,
  type OnboardingChecklist,
  type OnboardingChecklistItem,
} from "@/lib/db/schema";
import {
  getOnboardingItemsForMode,
  type StoreMode,
} from "@/lib/config/onboarding";

/**
 * Create an onboarding checklist for a new store
 * Returns null if table doesn't exist (migration not yet applied)
 */
export async function createOnboardingChecklist(
  tenantId: string,
  storeSlug: string,
  storeMode: StoreMode
): Promise<OnboardingChecklist | null> {
  try {
    const items = getOnboardingItemsForMode(storeMode, storeSlug);

    const [checklist] = await db
      .insert(onboardingChecklists)
      .values({
        tenantId,
        items,
        totalCount: items.length,
        completedCount: 0,
      })
      .returning();

    return checklist;
  } catch (error) {
    // Table might not exist if migration hasn't been applied yet
    if (
      error instanceof Error &&
      error.message.includes("onboarding_checklists")
    ) {
      console.warn(
        "onboarding_checklists table not found - run migrations to enable this feature"
      );
      return null;
    }
    throw error;
  }
}

/**
 * Get onboarding checklist for a tenant
 * Returns null if table doesn't exist (migration not yet applied)
 */
export async function getOnboardingChecklist(
  tenantId: string
): Promise<OnboardingChecklist | null> {
  try {
    const [checklist] = await db
      .select()
      .from(onboardingChecklists)
      .where(eq(onboardingChecklists.tenantId, tenantId))
      .limit(1);

    return checklist ?? null;
  } catch (error) {
    // Table might not exist if migration hasn't been applied yet
    // Check for "relation does not exist" error
    if (
      error instanceof Error &&
      error.message.includes("onboarding_checklists")
    ) {
      console.warn(
        "onboarding_checklists table not found - run migrations to enable this feature"
      );
      return null;
    }
    throw error;
  }
}

/**
 * Mark a checklist item as complete
 */
export async function completeOnboardingItem(
  tenantId: string,
  itemId: string
): Promise<OnboardingChecklist | null> {
  const checklist = await getOnboardingChecklist(tenantId);
  if (!checklist) return null;

  const updatedItems = checklist.items.map((item) =>
    item.id === itemId
      ? { ...item, completed: true, completedAt: new Date().toISOString() }
      : item
  );

  const completedCount = updatedItems.filter((item) => item.completed).length;

  const [updated] = await db
    .update(onboardingChecklists)
    .set({
      items: updatedItems,
      completedCount,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(onboardingChecklists.tenantId, tenantId))
    .returning();

  return updated ?? null;
}

/**
 * Mark a checklist item as incomplete
 */
export async function uncompleteOnboardingItem(
  tenantId: string,
  itemId: string
): Promise<OnboardingChecklist | null> {
  const checklist = await getOnboardingChecklist(tenantId);
  if (!checklist) return null;

  const updatedItems = checklist.items.map((item) =>
    item.id === itemId
      ? { ...item, completed: false, completedAt: undefined }
      : item
  );

  const completedCount = updatedItems.filter((item) => item.completed).length;

  const [updated] = await db
    .update(onboardingChecklists)
    .set({
      items: updatedItems,
      completedCount,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(onboardingChecklists.tenantId, tenantId))
    .returning();

  return updated ?? null;
}

/**
 * Dismiss the onboarding checklist
 */
export async function dismissOnboardingChecklist(
  tenantId: string
): Promise<OnboardingChecklist | null> {
  const [updated] = await db
    .update(onboardingChecklists)
    .set({
      isDismissed: true,
      dismissedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(onboardingChecklists.tenantId, tenantId))
    .returning();

  return updated ?? null;
}

/**
 * Update item hrefs when store slug changes
 * (In case store is renamed)
 */
export async function updateChecklistHrefs(
  tenantId: string,
  newSlug: string,
  storeMode: StoreMode
): Promise<void> {
  const checklist = await getOnboardingChecklist(tenantId);
  if (!checklist) return;

  // Generate fresh items with new slug but preserve completion status
  const freshItems = getOnboardingItemsForMode(storeMode, newSlug);
  const completedMap = new Map(
    checklist.items.map((item) => [
      item.id,
      { completed: item.completed, completedAt: item.completedAt },
    ])
  );

  const updatedItems: OnboardingChecklistItem[] = freshItems.map((item) => ({
    ...item,
    completed: completedMap.get(item.id)?.completed ?? false,
    completedAt: completedMap.get(item.id)?.completedAt,
  }));

  await db
    .update(onboardingChecklists)
    .set({
      items: updatedItems,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(onboardingChecklists.tenantId, tenantId));
}
