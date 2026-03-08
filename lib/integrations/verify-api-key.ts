"use server";

import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Verify an API key against a tenant's external_api_key.
 * Used by all Sales Channel API endpoints (AutoDS, etc.)
 */
export async function verifyApiKey(
  tenantId: string,
  request: Request
): Promise<boolean> {
  const apiKey =
    request.headers.get("x-kaka-malem-key") ||
    request.headers.get("Authorization")?.replace("Bearer ", "");

  if (!apiKey) return false;

  const store = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { externalApiKey: true },
  });

  return store?.externalApiKey === apiKey;
}
