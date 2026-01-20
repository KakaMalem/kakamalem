"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import {
  completeOnboardingItem,
  uncompleteOnboardingItem,
  dismissOnboardingChecklist,
} from "@/lib/db/queries/onboarding";

export type OnboardingActionResult = {
  success?: boolean;
  error?: string;
};

/**
 * Mark an onboarding checklist item as complete
 */
export async function completeOnboardingItemAction(
  storeSlug: string,
  itemId: string
): Promise<OnboardingActionResult> {
  const user = await getUser();

  if (!user) {
    return { error: "You must be logged in" };
  }

  const store = await getTenantBySlug(storeSlug);
  if (!store) {
    return { error: "Store not found" };
  }

  // Only owner can update checklist
  if (store.ownerId !== user.id) {
    return { error: "You don't have permission to update this checklist" };
  }

  try {
    await completeOnboardingItem(store.id, itemId);
    revalidatePath(`/dashboard/${storeSlug}`, "page");
    return { success: true };
  } catch {
    return { error: "Failed to update checklist" };
  }
}

/**
 * Mark an onboarding checklist item as incomplete
 */
export async function uncompleteOnboardingItemAction(
  storeSlug: string,
  itemId: string
): Promise<OnboardingActionResult> {
  const user = await getUser();

  if (!user) {
    return { error: "You must be logged in" };
  }

  const store = await getTenantBySlug(storeSlug);
  if (!store) {
    return { error: "Store not found" };
  }

  if (store.ownerId !== user.id) {
    return { error: "You don't have permission to update this checklist" };
  }

  try {
    await uncompleteOnboardingItem(store.id, itemId);
    revalidatePath(`/dashboard/${storeSlug}`, "page");
    return { success: true };
  } catch {
    return { error: "Failed to update checklist" };
  }
}

/**
 * Dismiss the onboarding checklist
 */
export async function dismissOnboardingAction(
  storeSlug: string
): Promise<OnboardingActionResult> {
  const user = await getUser();

  if (!user) {
    return { error: "You must be logged in" };
  }

  const store = await getTenantBySlug(storeSlug);
  if (!store) {
    return { error: "Store not found" };
  }

  if (store.ownerId !== user.id) {
    return { error: "You don't have permission to dismiss this checklist" };
  }

  try {
    await dismissOnboardingChecklist(store.id);
    revalidatePath(`/dashboard/${storeSlug}`, "page");
    return { success: true };
  } catch {
    return { error: "Failed to dismiss checklist" };
  }
}
