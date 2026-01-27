import { cache } from "react";
import {
  eq,
  and,
  desc,
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
  type CustomerSnapshot,
  type OrderChannel,
} from "@/lib/db/schema";
import type {
  OfflineSalesFilters,
  PaymentMethod,
} from "@/lib/validations/offline-sales";

// =============================================================================
// TYPES
// =============================================================================

export type OfflineSale = {
  id: string;
  orderNumber: string;
  receiptNumber: string | null;
  customerSnapshot: CustomerSnapshot;
  channel: OrderChannel;
  paymentMethod: PaymentMethod | null;
  isPaid: boolean;
  paidAt: string | null;
  subtotal: string;
  discountTotal: string;
  total: string;
  status: string;
  staffNotes: string | null;
  createdAt: string;
  itemCount: number;
};

export type OfflineSaleDetail = {
  id: string;
  orderNumber: string;
  receiptNumber: string | null;
  tenantId: string;
  customerSnapshot: CustomerSnapshot;
  channel: OrderChannel;
  paymentMethod: PaymentMethod | null;
  isPaid: boolean;
  paidAt: string | null;
  subtotal: string;
  discountTotal: string;
  total: string;
  status: string;
  staffNotes: string | null;
  createdAt: string;
  updatedAt: string;
  items: OfflineSaleItem[];
  store: {
    name: string;
    logoUrl: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    currency: string;
  };
};

export type OfflineSaleItem = {
  id: string;
  productId: string | null; // Nullable if product was deleted but order history preserved
  productName: string;
  variantName: string | null;
  sku: string | null;
  price: string;
  quantity: number;
  imageUrl: string | null;
};

export type OfflineSalesCounts = {
  total: number;
  today: number;
  unpaid: number;
  thisMonth: number;
};

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get offline and phone sales with pagination and filtering
 */
export const getOfflineSales = cache(
  async (
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      filters?: OfflineSalesFilters;
    } = {}
  ): Promise<{
    sales: OfflineSale[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> => {
    const { page = 1, limit = 25, filters = {} } = options;
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [
      eq(orders.tenantId, tenantId),
      // Only POS channel (in-store sales)
      eq(orders.channel, "pos"),
    ];

    // Add filters
    if (filters.channel && filters.channel !== "all") {
      conditions.push(eq(orders.channel, filters.channel));
    }

    if (filters.paymentMethod) {
      conditions.push(eq(orders.paymentMethod, filters.paymentMethod));
    }

    if (filters.isPaid !== undefined) {
      conditions.push(eq(orders.isPaid, filters.isPaid));
    }

    if (filters.dateFrom) {
      conditions.push(gte(orders.createdAt, filters.dateFrom));
    }

    if (filters.dateTo) {
      conditions.push(lte(orders.createdAt, filters.dateTo + "T23:59:59.999Z"));
    }

    if (filters.search) {
      const searchCondition = or(
        ilike(orders.orderNumber, `%${filters.search}%`),
        ilike(orders.receiptNumber, `%${filters.search}%`),
        sql`${orders.customerSnapshot}->>'name' ILIKE ${"%" + filters.search + "%"}`,
        sql`${orders.customerSnapshot}->>'phone' ILIKE ${"%" + filters.search + "%"}`
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    // Query sales
    const salesList = await db.query.orders.findMany({
      where: and(...conditions),
      orderBy: [desc(orders.createdAt)],
      limit,
      offset,
      with: {
        items: {
          columns: { quantity: true },
        },
      },
    });

    // Transform to OfflineSale format
    const sales: OfflineSale[] = salesList.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      receiptNumber: order.receiptNumber,
      customerSnapshot: order.customerSnapshot,
      channel: order.channel as OrderChannel,
      paymentMethod: order.paymentMethod as PaymentMethod | null,
      isPaid: order.isPaid,
      paidAt: order.paidAt,
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      total: order.total,
      status: order.status,
      staffNotes: order.staffNotes,
      createdAt: order.createdAt,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    }));

    // Get total count
    const [countResult] = await db
      .select({ count: drizzleCount() })
      .from(orders)
      .where(and(...conditions));

    const total = countResult?.count || 0;

    return {
      sales,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
);

/**
 * Get a single offline sale with full details including store info
 */
export const getOfflineSaleById = cache(
  async (
    tenantId: string,
    orderId: string
  ): Promise<OfflineSaleDetail | null> => {
    const order = await db.query.orders.findFirst({
      where: and(
        eq(orders.id, orderId),
        eq(orders.tenantId, tenantId),
        eq(orders.channel, "pos")
      ),
      with: {
        tenant: {
          columns: {
            name: true,
            logoUrl: true,
            contactPhone: true,
            contactEmail: true,
            currency: true,
          },
        },
      },
    });

    if (!order) return null;

    // Get items with images
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

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      receiptNumber: order.receiptNumber,
      tenantId: order.tenantId,
      customerSnapshot: order.customerSnapshot,
      channel: order.channel as OrderChannel,
      paymentMethod: order.paymentMethod as PaymentMethod | null,
      isPaid: order.isPaid,
      paidAt: order.paidAt,
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      total: order.total,
      status: order.status,
      staffNotes: order.staffNotes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku,
        price: item.price,
        quantity: item.quantity,
        imageUrl: item.imageUrl,
      })),
      store: {
        name: order.tenant.name,
        logoUrl: order.tenant.logoUrl,
        contactPhone: order.tenant.contactPhone,
        contactEmail: order.tenant.contactEmail,
        currency: order.tenant.currency,
      },
    };
  }
);

/**
 * Get counts for POS/in-store sales dashboard badges
 */
export const getOfflineSalesCounts = cache(
  async (tenantId: string): Promise<OfflineSalesCounts> => {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).toISOString();
    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).toISOString();

    // Base condition for POS sales
    const baseCondition = and(
      eq(orders.tenantId, tenantId),
      eq(orders.channel, "pos")
    );

    // Execute all count queries in parallel
    const [totalResult, todayResult, unpaidResult, monthResult] =
      await Promise.all([
        // Total offline sales
        db.select({ count: drizzleCount() }).from(orders).where(baseCondition),

        // Today's sales
        db
          .select({ count: drizzleCount() })
          .from(orders)
          .where(and(baseCondition, gte(orders.createdAt, todayStart))),

        // Unpaid sales
        db
          .select({ count: drizzleCount() })
          .from(orders)
          .where(and(baseCondition, eq(orders.isPaid, false))),

        // This month's sales
        db
          .select({ count: drizzleCount() })
          .from(orders)
          .where(and(baseCondition, gte(orders.createdAt, monthStart))),
      ]);

    return {
      total: totalResult[0]?.count || 0,
      today: todayResult[0]?.count || 0,
      unpaid: unpaidResult[0]?.count || 0,
      thisMonth: monthResult[0]?.count || 0,
    };
  }
);

/**
 * Get any order with full details for receipt printing (no channel filter)
 */
export const getOrderForReceipt = cache(
  async (
    tenantId: string,
    orderId: string
  ): Promise<OfflineSaleDetail | null> => {
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)),
      with: {
        tenant: {
          columns: {
            name: true,
            logoUrl: true,
            contactPhone: true,
            contactEmail: true,
            currency: true,
          },
        },
      },
    });

    if (!order) return null;

    // Get items with images
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

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      receiptNumber: order.receiptNumber,
      tenantId: order.tenantId,
      customerSnapshot: order.customerSnapshot,
      channel: order.channel as OrderChannel,
      paymentMethod: order.paymentMethod as PaymentMethod | null,
      isPaid: order.isPaid,
      paidAt: order.paidAt,
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      total: order.total,
      status: order.status,
      staffNotes: order.staffNotes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku,
        price: item.price,
        quantity: item.quantity,
        imageUrl: item.imageUrl,
      })),
      store: {
        name: order.tenant.name,
        logoUrl: order.tenant.logoUrl,
        contactPhone: order.tenant.contactPhone,
        contactEmail: order.tenant.contactEmail,
        currency: order.tenant.currency,
      },
    };
  }
);

/**
 * Get today's offline sales revenue
 */
export const getTodayOfflineSalesRevenue = cache(
  async (tenantId: string): Promise<number> => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const result = await db
      .select({
        total: sql<string>`COALESCE(SUM(${orders.total}::numeric), 0)`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.channel, "pos"),
          eq(orders.isPaid, true),
          gte(orders.createdAt, todayStart.toISOString())
        )
      );

    return parseFloat(result[0]?.total || "0");
  }
);
