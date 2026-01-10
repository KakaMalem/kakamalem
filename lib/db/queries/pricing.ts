import { db } from "@/lib/db";
import {
  priceTiers,
  customerGroups,
  customerGroupMembers,
  customerGroupPrices,
  scheduledSales,
  type PriceTier,
  type NewPriceTier,
  type CustomerGroup,
  type NewCustomerGroup,
  type CustomerGroupMember,
  type NewCustomerGroupMember,
  type CustomerGroupPrice,
  type NewCustomerGroupPrice,
  type ScheduledSale,
  type NewScheduledSale,
} from "@/lib/db/schema";
import { eq, and, desc, asc, lte, gte } from "drizzle-orm";

// ============================================================================
// PRICE TIERS
// ============================================================================

/**
 * Get all price tiers for a product, sorted by minQuantity
 */
export async function getProductPriceTiers(
  productId: string
): Promise<PriceTier[]> {
  return db.query.priceTiers.findMany({
    where: eq(priceTiers.productId, productId),
    orderBy: [asc(priceTiers.minQuantity)],
  });
}

/**
 * Create a new price tier for a product
 */
export async function createPriceTier(data: NewPriceTier): Promise<PriceTier> {
  const [tier] = await db.insert(priceTiers).values(data).returning();
  return tier;
}

/**
 * Update a price tier
 */
export async function updatePriceTier(
  id: string,
  data: Partial<Omit<NewPriceTier, "id" | "tenantId" | "productId">>
): Promise<PriceTier | null> {
  const [tier] = await db
    .update(priceTiers)
    .set(data)
    .where(eq(priceTiers.id, id))
    .returning();
  return tier ?? null;
}

/**
 * Delete a price tier
 */
export async function deletePriceTier(id: string): Promise<void> {
  await db.delete(priceTiers).where(eq(priceTiers.id, id));
}

/**
 * Delete all price tiers for a product (useful when replacing tiers)
 */
export async function deleteProductPriceTiers(
  productId: string
): Promise<void> {
  await db.delete(priceTiers).where(eq(priceTiers.productId, productId));
}

/**
 * Replace all price tiers for a product with new ones
 */
export async function replaceProductPriceTiers(
  productId: string,
  tenantId: string,
  tiers: Array<
    Omit<NewPriceTier, "id" | "tenantId" | "productId" | "createdAt">
  >
): Promise<PriceTier[]> {
  // Delete existing tiers
  await deleteProductPriceTiers(productId);

  // Insert new tiers
  if (tiers.length === 0) return [];

  const newTiers = await db
    .insert(priceTiers)
    .values(
      tiers.map((tier) => ({
        ...tier,
        tenantId,
        productId,
      }))
    )
    .returning();

  return newTiers;
}

// ============================================================================
// CUSTOMER GROUPS
// ============================================================================

/**
 * Get all customer groups for a tenant
 */
export async function getTenantCustomerGroups(
  tenantId: string
): Promise<CustomerGroup[]> {
  return db.query.customerGroups.findMany({
    where: eq(customerGroups.tenantId, tenantId),
    orderBy: [asc(customerGroups.name)],
  });
}

/**
 * Get a customer group by ID
 */
export async function getCustomerGroupById(
  id: string
): Promise<CustomerGroup | null> {
  const group = await db.query.customerGroups.findFirst({
    where: eq(customerGroups.id, id),
  });
  return group ?? null;
}

/**
 * Create a new customer group
 */
export async function createCustomerGroup(
  data: NewCustomerGroup
): Promise<CustomerGroup> {
  // If this is set as default, unset other defaults first
  if (data.isDefault) {
    await db
      .update(customerGroups)
      .set({ isDefault: false })
      .where(eq(customerGroups.tenantId, data.tenantId));
  }

  const [group] = await db.insert(customerGroups).values(data).returning();
  return group;
}

/**
 * Update a customer group
 */
export async function updateCustomerGroup(
  id: string,
  data: Partial<Omit<NewCustomerGroup, "id" | "tenantId">>
): Promise<CustomerGroup | null> {
  // If setting as default, unset other defaults first
  if (data.isDefault) {
    const group = await getCustomerGroupById(id);
    if (group) {
      await db
        .update(customerGroups)
        .set({ isDefault: false })
        .where(eq(customerGroups.tenantId, group.tenantId));
    }
  }

  const [updated] = await db
    .update(customerGroups)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(customerGroups.id, id))
    .returning();

  return updated ?? null;
}

/**
 * Delete a customer group
 */
export async function deleteCustomerGroup(id: string): Promise<void> {
  await db.delete(customerGroups).where(eq(customerGroups.id, id));
}

// ============================================================================
// CUSTOMER GROUP MEMBERS
// ============================================================================

/**
 * Get customer's group membership for a tenant
 */
export async function getCustomerGroupMembership(
  userId: string,
  tenantId: string
): Promise<CustomerGroupMember | null> {
  const membership = await db.query.customerGroupMembers.findFirst({
    where: and(
      eq(customerGroupMembers.userId, userId),
      eq(customerGroupMembers.tenantId, tenantId)
    ),
  });
  return membership ?? null;
}

/**
 * Get all members of a customer group
 */
export async function getCustomerGroupMembers(
  customerGroupId: string
): Promise<CustomerGroupMember[]> {
  return db.query.customerGroupMembers.findMany({
    where: eq(customerGroupMembers.customerGroupId, customerGroupId),
  });
}

/**
 * Add a user to a customer group (replaces existing membership)
 */
export async function setCustomerGroupMembership(
  data: NewCustomerGroupMember
): Promise<CustomerGroupMember> {
  // Remove existing membership
  await db
    .delete(customerGroupMembers)
    .where(
      and(
        eq(customerGroupMembers.userId, data.userId),
        eq(customerGroupMembers.tenantId, data.tenantId)
      )
    );

  // Add new membership
  const [membership] = await db
    .insert(customerGroupMembers)
    .values(data)
    .returning();
  return membership;
}

/**
 * Remove a user from their customer group
 */
export async function removeCustomerGroupMembership(
  userId: string,
  tenantId: string
): Promise<void> {
  await db
    .delete(customerGroupMembers)
    .where(
      and(
        eq(customerGroupMembers.userId, userId),
        eq(customerGroupMembers.tenantId, tenantId)
      )
    );
}

// ============================================================================
// CUSTOMER GROUP PRICES
// ============================================================================

/**
 * Get all group prices for a product
 */
export async function getProductGroupPrices(
  productId: string
): Promise<CustomerGroupPrice[]> {
  return db.query.customerGroupPrices.findMany({
    where: eq(customerGroupPrices.productId, productId),
  });
}

/**
 * Get group price for a specific product and group
 */
export async function getProductGroupPrice(
  productId: string,
  customerGroupId: string
): Promise<CustomerGroupPrice | null> {
  const price = await db.query.customerGroupPrices.findFirst({
    where: and(
      eq(customerGroupPrices.productId, productId),
      eq(customerGroupPrices.customerGroupId, customerGroupId)
    ),
  });
  return price ?? null;
}

/**
 * Set group price for a product (upsert)
 */
export async function setProductGroupPrice(
  data: NewCustomerGroupPrice
): Promise<CustomerGroupPrice> {
  // Check if exists
  const existing = await getProductGroupPrice(
    data.productId,
    data.customerGroupId
  );

  if (existing) {
    const [updated] = await db
      .update(customerGroupPrices)
      .set({
        price: data.price,
        compareAtPrice: data.compareAtPrice,
      })
      .where(eq(customerGroupPrices.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(customerGroupPrices)
    .values(data)
    .returning();
  return created;
}

/**
 * Delete group price for a product
 */
export async function deleteProductGroupPrice(
  productId: string,
  customerGroupId: string
): Promise<void> {
  await db
    .delete(customerGroupPrices)
    .where(
      and(
        eq(customerGroupPrices.productId, productId),
        eq(customerGroupPrices.customerGroupId, customerGroupId)
      )
    );
}

// ============================================================================
// SCHEDULED SALES
// ============================================================================

/**
 * Get all scheduled sales for a product
 */
export async function getProductScheduledSales(
  productId: string
): Promise<ScheduledSale[]> {
  return db.query.scheduledSales.findMany({
    where: eq(scheduledSales.productId, productId),
    orderBy: [desc(scheduledSales.startsAt)],
  });
}

/**
 * Get all scheduled sales for a tenant
 */
export async function getTenantScheduledSales(
  tenantId: string
): Promise<ScheduledSale[]> {
  return db.query.scheduledSales.findMany({
    where: eq(scheduledSales.tenantId, tenantId),
    orderBy: [desc(scheduledSales.startsAt)],
  });
}

/**
 * Get all scheduled sales for a tenant with product info
 */
export async function getTenantScheduledSalesWithProducts(tenantId: string) {
  return db.query.scheduledSales.findMany({
    where: eq(scheduledSales.tenantId, tenantId),
    orderBy: [desc(scheduledSales.startsAt)],
    with: {
      product: {
        columns: {
          id: true,
          name: true,
          price: true,
        },
      },
    },
  });
}

/**
 * Get active sales for a product (currently running)
 */
export async function getActiveProductSales(
  productId: string,
  now: Date = new Date()
): Promise<ScheduledSale[]> {
  const nowStr = now.toISOString();

  return db.query.scheduledSales.findMany({
    where: and(
      eq(scheduledSales.productId, productId),
      eq(scheduledSales.isActive, true),
      lte(scheduledSales.startsAt, nowStr),
      gte(scheduledSales.endsAt, nowStr)
    ),
    orderBy: [desc(scheduledSales.priority)],
  });
}

/**
 * Get the highest priority active sale for a product
 */
export async function getActiveProductSale(
  productId: string,
  now: Date = new Date()
): Promise<ScheduledSale | null> {
  const sales = await getActiveProductSales(productId, now);
  return sales[0] ?? null;
}

/**
 * Create a new scheduled sale
 */
export async function createScheduledSale(
  data: NewScheduledSale
): Promise<ScheduledSale> {
  const [sale] = await db.insert(scheduledSales).values(data).returning();
  return sale;
}

/**
 * Update a scheduled sale
 */
export async function updateScheduledSale(
  id: string,
  data: Partial<Omit<NewScheduledSale, "id" | "tenantId" | "productId">>
): Promise<ScheduledSale | null> {
  const [sale] = await db
    .update(scheduledSales)
    .set(data)
    .where(eq(scheduledSales.id, id))
    .returning();
  return sale ?? null;
}

/**
 * Delete a scheduled sale
 */
export async function deleteScheduledSale(id: string): Promise<void> {
  await db.delete(scheduledSales).where(eq(scheduledSales.id, id));
}

/**
 * Toggle a scheduled sale's active status
 */
export async function toggleScheduledSaleActive(
  id: string,
  isActive: boolean
): Promise<ScheduledSale | null> {
  return updateScheduledSale(id, { isActive });
}
