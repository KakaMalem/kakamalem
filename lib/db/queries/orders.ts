import { cache } from "react";
import {
  eq,
  and,
  desc,
  asc,
  or,
  ilike,
  gte,
  lte,
  sql,
  count as drizzleCount,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  orders,
  orderItems,
  products,
  media,
  productImages,
  type Address,
  type CustomerSnapshot,
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

// =============================================================================
// ORDER QUERIES (DASHBOARD VIEW)
// =============================================================================
// Admin/staff view - no userId filter, full tenant access

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

export type OrderFilters = {
  search?: string;
  status?: OrderStatus | "all";
  dateFrom?: string;
  dateTo?: string;
};

export type OrderSort = {
  field: "createdAt" | "total" | "status" | "orderNumber";
  direction: "asc" | "desc";
};

export type DashboardOrder = {
  id: string;
  orderNumber: string;
  customerSnapshot: CustomerSnapshot;
  shippingAddress: Address;
  subtotal: string;
  shippingTotal: string;
  taxTotal: string;
  discountTotal: string;
  total: string;
  status: OrderStatus;
  customerNotes: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
};

/**
 * Get orders for dashboard with pagination, filtering, and sorting
 */
export const getDashboardOrders = cache(
  async (
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      filters?: OrderFilters;
      sort?: OrderSort;
    } = {}
  ): Promise<{
    orders: DashboardOrder[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> => {
    const { page = 1, limit = 25, filters = {}, sort } = options;
    const offset = (page - 1) * limit;

    // Use relational query API (same pattern as getCustomerOrders that works)
    const ordersList = await db.query.orders.findMany({
      where: and(
        eq(orders.tenantId, tenantId),
        filters.search
          ? or(
              ilike(orders.orderNumber, `%${filters.search}%`),
              sql`${orders.customerSnapshot}->>'name' ILIKE ${"%" + filters.search + "%"}`,
              sql`${orders.customerSnapshot}->>'email' ILIKE ${"%" + filters.search + "%"}`
            )
          : undefined,
        filters.status && filters.status !== "all"
          ? eq(orders.status, filters.status)
          : undefined,
        filters.dateFrom ? gte(orders.createdAt, filters.dateFrom) : undefined,
        filters.dateTo
          ? lte(orders.createdAt, filters.dateTo + "T23:59:59.999Z")
          : undefined
      ),
      orderBy: sort
        ? sort.direction === "asc"
          ? [
              asc(
                sort.field === "total"
                  ? orders.total
                  : sort.field === "status"
                    ? orders.status
                    : sort.field === "orderNumber"
                      ? orders.orderNumber
                      : orders.createdAt
              ),
            ]
          : [
              desc(
                sort.field === "total"
                  ? orders.total
                  : sort.field === "status"
                    ? orders.status
                    : sort.field === "orderNumber"
                      ? orders.orderNumber
                      : orders.createdAt
              ),
            ]
        : [desc(orders.createdAt)],
      limit,
      offset,
      with: {
        items: {
          columns: {
            quantity: true,
          },
        },
      },
    });

    // Transform to DashboardOrder format with item counts
    const ordersWithCounts: DashboardOrder[] = ordersList.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerSnapshot: order.customerSnapshot,
      shippingAddress: order.shippingAddress,
      subtotal: order.subtotal,
      shippingTotal: order.shippingTotal,
      taxTotal: order.taxTotal,
      discountTotal: order.discountTotal,
      total: order.total,
      status: order.status as OrderStatus,
      customerNotes: order.customerNotes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    }));

    // Get total count for pagination
    const [{ count: total }] = await db
      .select({ count: drizzleCount() })
      .from(orders)
      .where(eq(orders.tenantId, tenantId));

    return {
      orders: ordersWithCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
);

export type DashboardOrderDetail = {
  id: string;
  orderNumber: string;
  tenantId: string;
  userId: string | null;
  storeCustomerId: string | null;
  customerSnapshot: CustomerSnapshot;
  shippingAddress: Address;
  billingAddress: Address | null;
  subtotal: string;
  shippingTotal: string;
  taxTotal: string;
  discountTotal: string;
  total: string;
  status: OrderStatus;
  customerNotes: string | null;
  staffNotes: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItemWithImage[];
};

export type OrderItemWithImage = {
  id: string;
  productId: string;
  productName: string;
  variantName: string | null;
  sku: string | null;
  price: string;
  quantity: number;
  image: {
    url: string;
    alt: string | null;
  } | null;
};

/**
 * Get a single order with full details for dashboard (admin view - no userId check)
 */
export const getDashboardOrderById = cache(
  async (
    tenantId: string,
    orderId: string
  ): Promise<DashboardOrderDetail | null> => {
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)),
    });

    if (!order) {
      return null;
    }

    // Get order items with images
    // Use leftJoin for products in case a product was deleted after the order
    const items = await db
      .select({
        id: orderItems.id,
        productId: orderItems.productId,
        productName: orderItems.productName,
        variantName: orderItems.variantName,
        sku: orderItems.sku,
        price: orderItems.price,
        quantity: orderItems.quantity,
        imageUrl: media.url,
        imageAlt: media.altText,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .leftJoin(
        productImages,
        and(
          eq(productImages.productId, orderItems.productId),
          eq(productImages.position, 0)
        )
      )
      .leftJoin(media, eq(productImages.mediaId, media.id))
      .where(eq(orderItems.orderId, orderId));

    const itemsWithImages: OrderItemWithImage[] = items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      variantName: item.variantName,
      sku: item.sku,
      price: item.price,
      quantity: item.quantity,
      image: item.imageUrl
        ? {
            url: item.imageUrl,
            alt: item.imageAlt,
          }
        : null,
    }));

    return {
      ...order,
      items: itemsWithImages,
    } as DashboardOrderDetail;
  }
);

export type OrderCounts = {
  total: number;
  pending: number;
  confirmed: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  refunded: number;
};

/**
 * Get order counts by status for dashboard badges
 */
export const getOrderCounts = cache(
  async (tenantId: string): Promise<OrderCounts> => {
    const counts = await db
      .select({
        status: orders.status,
        count: drizzleCount(),
      })
      .from(orders)
      .where(eq(orders.tenantId, tenantId))
      .groupBy(orders.status);

    // Initialize all counts to 0
    const result: OrderCounts = {
      total: 0,
      pending: 0,
      confirmed: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      refunded: 0,
    };

    // Fill in counts from query results
    counts.forEach(({ status, count }) => {
      const statusKey = status as keyof Omit<OrderCounts, "total">;
      if (statusKey in result) {
        result[statusKey] = count;
      }
      result.total += count;
    });

    return result;
  }
);
