"use server";

import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getTenantByOwnerId(ownerId: string) {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.ownerId, ownerId),
  });

  return tenant;
}

export async function getTenantById(tenantId: string) {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  return tenant;
}

export async function getTenantBySlug(slug: string) {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
  });

  return tenant;
}
