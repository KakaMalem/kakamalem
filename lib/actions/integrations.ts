"use server";

import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getUserStoreContext } from "@/lib/auth/context";
import crypto from "crypto";

export async function generateExternalApiKeyAction(tenantId: string) {
  try {
    const context = await getUserStoreContext(tenantId);
    if (!context || context.role !== "owner") {
      return { success: false, error: "Only store owners can manage API keys" };
    }

    // Generate a secure API key with prefix
    const key = `km_${crypto.randomBytes(32).toString("hex")}`;

    await db
      .update(tenants)
      .set({ externalApiKey: key, updatedAt: new Date().toISOString() })
      .where(eq(tenants.id, tenantId));

    revalidatePath(`/dashboard/[slug]/settings/integrations`, "page");
    return { success: true, key };
  } catch (error) {
    console.error("Failed to generate API key:", error);
    return { success: false, error: "Internal server error" };
  }
}

export async function revokeExternalApiKeyAction(tenantId: string) {
  try {
    const context = await getUserStoreContext(tenantId);
    if (!context || context.role !== "owner") {
      return { success: false, error: "Only store owners can manage API keys" };
    }

    await db
      .update(tenants)
      .set({ externalApiKey: null, updatedAt: new Date().toISOString() })
      .where(eq(tenants.id, tenantId));

    revalidatePath(`/dashboard/[slug]/settings/integrations`, "page");
    return { success: true };
  } catch (error) {
    console.error("Failed to revoke API key:", error);
    return { success: false, error: "Internal server error" };
  }
}
