import { cache } from "react";
import { eq, and, desc, count as drizzleCount } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  orders,
  orderItems,
  products,
  media,
  productImages,
} from "@/lib/db/schema";

// =============================================================================
// ORDER QUERIES (CUSTOMER VIEW)
// =============================================================================
// Orders are tenant-scoped but filtered by userId for customer view

export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;

/**
 * Get orders for a user at a specific store with pagination
 */
export const getCustomerOrders = cache(
  async (
    tenantId: string,
    userId: string,
    options?: { limit?: number; offset?: number }
  ) => {
    const { limit = 10, offset = 0 } = options || {};

    const orderList = await db.query.orders.findMany({
      where: and(eq(orders.tenantId, tenantId), eq(orders.userId, userId)),
      orderBy: [desc(orders.createdAt)],
      limit,
      offset,
      with: {
        items: {
          columns: {
            id: true,
            productName: true,
            variantName: true,
            quantity: true,
            price: true,
          },
        },
      },
    });

    return orderList;
  }
);

/**
 * Get order count for a user at a specific store
 */
export const getCustomerOrderCount = cache(
  async (tenantId: string, userId: string) => {
    const result = await db
      .select({ count: drizzleCount() })
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.userId, userId)));

    return result[0]?.count || 0;
  }
);

/**
 * Get a single order with full details (with ownership check)
 */
export const getOrderById = cache(
  async (orderId: string, userId: string, tenantId: string) => {
    const order = await db.query.orders.findFirst({
      where: and(
        eq(orders.id, orderId),
        eq(orders.userId, userId),
        eq(orders.tenantId, tenantId)
      ),
      with: {
        items: true,
        shipments: {
          with: {
            trackingEvents: {
              orderBy: (events, { desc }) => [desc(events.eventTime)],
            },
          },
        },
      },
    });

    return order;
  }
);

/**
 * Get order items with product images for display
 */
export const getOrderItemsWithImages = cache(async (orderId: string) => {
  const items = await db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      productName: orderItems.productName,
      variantName: orderItems.variantName,
      sku: orderItems.sku,
      price: orderItems.price,
      quantity: orderItems.quantity,
      productSlug: products.slug,
      productImage: {
        id: media.id,
        url: media.url,
        alt: media.altText,
      },
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .leftJoin(
      productImages,
      and(
        eq(productImages.productId, products.id),
        eq(productImages.position, 0)
      )
    )
    .leftJoin(media, eq(productImages.mediaId, media.id))
    .where(eq(orderItems.orderId, orderId));

  return items;
});

/**
 * Get recent orders summary for account dashboard
 */
export const getRecentOrdersSummary = cache(
  async (tenantId: string, userId: string, limit = 3) => {
    const recentOrders = await db.query.orders.findMany({
      where: and(eq(orders.tenantId, tenantId), eq(orders.userId, userId)),
      orderBy: [desc(orders.createdAt)],
      limit,
      columns: {
        id: true,
        orderNumber: true,
        total: true,
        status: true,
        createdAt: true,
      },
    });

    return recentOrders;
  }
);

// Re-export from utils for backwards compatibility in server components
export { getOrderStatusInfo } from "@/lib/utils/order-status";
