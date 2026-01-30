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
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import {
  orders,
  orderItems,
  orderPayments,
  orderTransactions,
  products,
  productVariants,
  media,
  productImages,
  shipments,
  type Address,
  type CustomerSnapshot,
  type ShipmentStatus,
  type OrderChannel,
  type PaymentStatus,
} from "@/lib/db/schema";
import { computePaymentStatus } from "@/lib/utils/payment-status";

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
 * Get order items with product/variant images for display
 * Prioritizes variant image over product image
 */
export const getOrderItemsWithImages = cache(async (orderId: string) => {
  const variantMedia = alias(media, "variant_media");

  const items = await db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      variantId: orderItems.variantId,
      productName: orderItems.productName,
      variantName: orderItems.variantName,
      sku: orderItems.sku,
      price: orderItems.price,
      quantity: orderItems.quantity,
      productSlug: products.slug,
      // Product image (fallback)
      productImageId: media.id,
      productImageUrl: media.url,
      productImageAlt: media.altText,
      // Variant image (priority)
      variantImageId: variantMedia.id,
      variantImageUrl: variantMedia.url,
      variantImageAlt: variantMedia.altText,
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
    // Join for variant image
    .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .leftJoin(variantMedia, eq(productVariants.imageId, variantMedia.id))
    .where(eq(orderItems.orderId, orderId));

  // Transform to prioritize variant image over product image
  return items.map((item) => {
    const imageUrl = item.variantImageUrl || item.productImageUrl;
    const imageId = item.variantImageId || item.productImageId;
    const imageAlt = item.variantImageUrl
      ? item.variantImageAlt
      : item.productImageAlt;

    return {
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      variantName: item.variantName,
      sku: item.sku,
      price: item.price,
      quantity: item.quantity,
      productSlug: item.productSlug,
      productImage: imageUrl
        ? {
            id: imageId,
            url: imageUrl,
            alt: imageAlt,
          }
        : null,
    };
  });
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
  | "returned"
  | "cancelled";

export type OrderFilters = {
  search?: string;
  status?: OrderStatus | "all";
  channel?: OrderChannel | "all";
  dateFrom?: string;
  dateTo?: string;
};

export type OrderSort = {
  field: "createdAt" | "total" | "status" | "orderNumber";
  direction: "asc" | "desc";
};

// Re-export types from schema for convenience
export type { OrderChannel, PaymentStatus } from "@/lib/db/schema";

export type FulfillmentType =
  | "shipping"
  | "pickup"
  | "instant"
  | "local_delivery"
  | "curbside";

export type DashboardOrder = {
  id: string;
  orderNumber: string;
  customerSnapshot: CustomerSnapshot;
  shippingAddress: Address | null;
  subtotal: string;
  shippingTotal: string;
  taxTotal: string;
  discountTotal: string;
  total: string;
  status: OrderStatus;
  channel: OrderChannel;
  fulfillmentType: FulfillmentType | null;
  paymentStatus: PaymentStatus;
  isPaid: boolean;
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
        filters.channel && filters.channel !== "all"
          ? eq(orders.channel, filters.channel)
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
    // Payment status is computed from amounts using the payment-status utility
    const ordersWithCounts: DashboardOrder[] = ordersList.map((order) => {
      const paymentInfo = computePaymentStatus({
        total: order.total,
        amountPaid: order.amountPaid,
        amountRefunded: order.amountRefunded,
      });

      return {
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
        channel: order.channel as OrderChannel,
        fulfillmentType: order.fulfillmentType as FulfillmentType | null,
        paymentStatus: paymentInfo.status as PaymentStatus,
        isPaid: paymentInfo.isPaid,
        customerNotes: order.customerNotes,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      };
    });

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

export type OrderPaymentRecord = {
  id: string;
  amount: string;
  paymentMethod: string;
  notes: string | null;
  createdAt: string;
};

export type ShipmentTrackingEventRecord = {
  id: string;
  status: ShipmentStatus;
  location: string | null;
  description: string | null;
  eventTime: string;
};

export type ShipmentItemRecord = {
  id: string;
  orderItemId: string;
  productName: string;
  variantName: string | null;
  quantity: number;
};

export type ShipmentRecord = {
  id: string;
  carrierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: ShipmentStatus;
  shippedAt: string | null;
  deliveredAt: string | null;
  notes: string | null;
  createdAt: string;
  items: ShipmentItemRecord[];
  trackingEvents: ShipmentTrackingEventRecord[];
};

export type DashboardOrderDetail = {
  id: string;
  orderNumber: string;
  receiptNumber: string | null;
  tenantId: string;
  userId: string | null;
  storeCustomerId: string | null;
  customerSnapshot: CustomerSnapshot;
  shippingAddress: Address | null;
  billingAddress: Address | null;
  subtotal: string;
  shippingTotal: string;
  taxTotal: string;
  discountTotal: string;
  total: string;
  status: OrderStatus;
  channel: OrderChannel;
  fulfillmentType: FulfillmentType;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  isPaid: boolean;
  paidAt: string | null;
  // Payment amounts
  amountPaid: string;
  amountRefunded: string;
  customerNotes: string | null;
  staffNotes: string | null;
  createdAt: string;
  updatedAt: string;
  // Lifecycle timestamps
  placedAt: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  items: OrderItemWithImage[];
  payments: OrderPaymentRecord[];
  shipments: ShipmentRecord[];
  // Computed payment fields
  totalPaid: string;
  amountRemaining: string;
};

export type OrderItemWithImage = {
  id: string;
  productId: string | null; // Nullable if product was deleted but order history preserved
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

    // Get order items with images, payments, refund transactions, and shipments in parallel
    const [items, payments, refundTransactions, shipmentsData] =
      await Promise.all([
        // Get order items with images (prioritize variant image over product image)
        // Use leftJoin for products/variants in case they were deleted after the order
        (async () => {
          const variantMedia = alias(media, "variant_media");
          return (
            db
              .select({
                id: orderItems.id,
                productId: orderItems.productId,
                variantId: orderItems.variantId,
                productName: orderItems.productName,
                variantName: orderItems.variantName,
                sku: orderItems.sku,
                price: orderItems.price,
                quantity: orderItems.quantity,
                // Product image (fallback)
                productImageUrl: media.url,
                productImageAlt: media.altText,
                // Variant image (priority)
                variantImageUrl: variantMedia.url,
                variantImageAlt: variantMedia.altText,
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
              // Join for variant image
              .leftJoin(
                productVariants,
                eq(orderItems.variantId, productVariants.id)
              )
              .leftJoin(
                variantMedia,
                eq(productVariants.imageId, variantMedia.id)
              )
              .where(eq(orderItems.orderId, orderId))
          );
        })(),
        // Get order payments
        db
          .select({
            id: orderPayments.id,
            amount: orderPayments.amount,
            paymentMethod: orderPayments.paymentMethod,
            notes: orderPayments.notes,
            createdAt: orderPayments.createdAt,
          })
          .from(orderPayments)
          .where(eq(orderPayments.orderId, orderId))
          .orderBy(desc(orderPayments.createdAt)),
        // Get refund transactions
        db
          .select({
            id: orderTransactions.id,
            amount: orderTransactions.amount,
            paymentMethod: orderTransactions.paymentMethod,
            notes: orderTransactions.notes,
            createdAt: orderTransactions.createdAt,
          })
          .from(orderTransactions)
          .where(
            and(
              eq(orderTransactions.orderId, orderId),
              eq(orderTransactions.type, "refund"),
              eq(orderTransactions.status, "completed")
            )
          )
          .orderBy(desc(orderTransactions.createdAt)),
        // Get shipments with tracking events
        db.query.shipments.findMany({
          where: eq(shipments.orderId, orderId),
          orderBy: [desc(shipments.createdAt)],
          with: {
            items: {
              with: {
                orderItem: {
                  columns: {
                    productName: true,
                    variantName: true,
                  },
                },
              },
            },
            trackingEvents: {
              orderBy: (events, { desc: descEvents }) => [
                descEvents(events.eventTime),
              ],
            },
          },
        }),
      ]);

    const itemsWithImages: OrderItemWithImage[] = items.map((item) => {
      // Prioritize variant image over product image
      const imageUrl = item.variantImageUrl || item.productImageUrl;
      const imageAlt = item.variantImageUrl
        ? item.variantImageAlt
        : item.productImageAlt;

      return {
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku,
        price: item.price,
        quantity: item.quantity,
        image: imageUrl
          ? {
              url: imageUrl,
              alt: imageAlt,
            }
          : null,
      };
    });

    // Calculate payment totals using the payment-status utility for consistency
    // Priority: 1) Sum of payment records, 2) amountPaid field, 3) if isPaid and no payments, assume full total
    const orderTotal = parseFloat(order.total);
    const paymentsSum = payments.reduce(
      (sum, p) => sum + parseFloat(p.amount),
      0
    );
    const orderAmountPaid = parseFloat(order.amountPaid);

    // Determine actual amount paid (for display purposes)
    let totalPaid: number;
    if (paymentsSum > 0) {
      // Use payment records if available
      totalPaid = paymentsSum;
    } else if (orderAmountPaid > 0) {
      // Use amountPaid field if set
      totalPaid = orderAmountPaid;
    } else if (order.isPaid) {
      // Legacy: if isPaid but no records, assume original total was paid
      // Note: This is a fallback for legacy orders; new orders should have amountPaid set
      totalPaid = orderTotal;
    } else {
      totalPaid = 0;
    }

    const amountRemaining = Math.max(0, orderTotal - totalPaid);

    // Compute payment status using the utility for consistency across the app
    const paymentInfo = computePaymentStatus({
      total: order.total,
      amountPaid: totalPaid.toString(),
      amountRefunded: order.amountRefunded,
    });

    // Format shipments data
    const formattedShipments: ShipmentRecord[] = shipmentsData.map(
      (shipment) => ({
        id: shipment.id,
        carrierName: shipment.carrierName,
        trackingNumber: shipment.trackingNumber,
        trackingUrl: shipment.trackingUrl,
        status: shipment.status,
        shippedAt: shipment.shippedAt,
        deliveredAt: shipment.deliveredAt,
        notes: shipment.notes,
        createdAt: shipment.createdAt,
        items: shipment.items.map((item) => ({
          id: item.id,
          orderItemId: item.orderItemId,
          productName: item.orderItem.productName,
          variantName: item.orderItem.variantName,
          quantity: item.quantity,
        })),
        trackingEvents: shipment.trackingEvents.map((event) => ({
          id: event.id,
          status: event.status,
          location: event.location,
          description: event.description,
          eventTime: event.eventTime,
        })),
      })
    );

    // Combine payments and refunds into a unified transaction history
    // Payments are positive, refunds are shown as negative for display
    const allTransactions: OrderPaymentRecord[] = [
      ...payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        notes: p.notes,
        createdAt: p.createdAt,
      })),
      ...refundTransactions.map((r) => ({
        id: r.id,
        // Show refunds as negative amounts in the transaction history
        amount: `-${r.amount}`,
        paymentMethod: r.paymentMethod,
        notes: r.notes,
        createdAt: r.createdAt,
      })),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return {
      ...order,
      // Override payment status with computed values for consistency
      paymentStatus: paymentInfo.status as PaymentStatus,
      isPaid: paymentInfo.isPaid,
      items: itemsWithImages,
      payments: allTransactions,
      shipments: formattedShipments,
      totalPaid: totalPaid.toFixed(2),
      amountRemaining: amountRemaining.toFixed(2),
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
  returned: number;
  cancelled: number;
  // Channel counts
  online: number;
  pos: number;
};

/**
 * Get order counts by status and channel for dashboard badges
 */
export const getOrderCounts = cache(
  async (tenantId: string): Promise<OrderCounts> => {
    // Get counts by status and channel in parallel
    const [statusCounts, channelCounts] = await Promise.all([
      db
        .select({
          status: orders.status,
          count: drizzleCount(),
        })
        .from(orders)
        .where(eq(orders.tenantId, tenantId))
        .groupBy(orders.status),
      db
        .select({
          channel: orders.channel,
          count: drizzleCount(),
        })
        .from(orders)
        .where(eq(orders.tenantId, tenantId))
        .groupBy(orders.channel),
    ]);

    // Initialize all counts to 0
    const result: OrderCounts = {
      total: 0,
      pending: 0,
      confirmed: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      returned: 0,
      cancelled: 0,
      online: 0,
      pos: 0,
    };

    // Fill in status counts
    statusCounts.forEach(({ status, count }) => {
      const statusKey = status as keyof Omit<
        OrderCounts,
        "total" | "online" | "pos"
      >;
      if (statusKey in result) {
        result[statusKey] = count;
      }
      result.total += count;
    });

    // Fill in channel counts
    channelCounts.forEach(({ channel, count }) => {
      const channelKey = channel as "online" | "pos";
      if (channelKey in result) {
        result[channelKey] = count;
      }
    });

    return result;
  }
);
