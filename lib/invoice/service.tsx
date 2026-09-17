import { renderToBuffer } from "@react-pdf/renderer";
import { randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  orders,
  tenants,
  orderInvoiceTokens,
  type Address,
  type CustomerSnapshot,
} from "@/lib/db/schema";
import { InvoiceDocument, type InvoiceData } from "./template";
import { computePaymentStatus } from "@/lib/utils/payment-status";
import {
  formatCoordinates,
  formatPostalAddressLines,
} from "@/lib/geo/address";

/**
 * Generate a secure random token for shareable invoice links
 */
export function generateInvoiceToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Convert GPS-based Address to invoice display address
 */
function formatAddressForInvoice(
  address: Address
): InvoiceData["order"]["shippingAddress"] {
  const addressLines = formatPostalAddressLines(address);

  return {
    firstName: address.firstName,
    lastName: address.lastName,
    // Street lines when the shopper typed an address; empty for a map pin.
    addressLines: addressLines.length > 0 ? addressLines : undefined,
    // Use city if available, or coordinates as fallback
    city: address.city,
    // Include notes which often contain delivery instructions
    notes: address.notes,
    phone: address.phone,
    // Include coordinates for reference
    // Coordinates only when there is a real pin (typed addresses store 0/0)
    coordinates: formatCoordinates(address) ?? undefined,
    plusCode: address.plusCode,
  };
}

/**
 * Get order data for invoice generation
 */
export async function getOrderForInvoice(
  orderId: string,
  tenantId: string
): Promise<InvoiceData | null> {
  // Get order with items
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)),
    with: {
      items: true,
    },
  });

  if (!order) return null;

  // Get tenant/store info
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: {
      id: true,
      name: true,
      contactEmail: true,
      contactPhone: true,
      receiptFooterText: true,
    },
  });

  if (!tenant) return null;

  // Parse customer snapshot
  const customerSnapshot = order.customerSnapshot as CustomerSnapshot | null;

  // Parse addresses
  const shippingAddress = order.shippingAddress as Address | null;
  const billingAddress = order.billingAddress as Address | null;

  // Build invoice data
  const invoiceData: InvoiceData = {
    store: {
      name: tenant.name,
      email: tenant.contactEmail || undefined,
      phone: tenant.contactPhone || undefined,
      footerText: tenant.receiptFooterText || undefined,
    },
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      placedAt: order.placedAt || order.createdAt,
      channel: order.channel,
      paymentStatus: order.paymentStatus,
      customerNotes: order.customerNotes || undefined,
      customer: {
        name: customerSnapshot?.name || "Customer",
        email: customerSnapshot?.email || "",
        phone: customerSnapshot?.phone,
      },
      shippingAddress: shippingAddress
        ? formatAddressForInvoice(shippingAddress)
        : undefined,
      billingAddress: billingAddress
        ? formatAddressForInvoice(billingAddress)
        : undefined,
      items: order.items.map((item) => ({
        productName: item.productName || "Product",
        variantName: item.variantName || undefined,
        sku: item.sku || undefined,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice || item.price || "0"),
        lineTotal: parseFloat(item.lineTotal || "0"),
      })),
      subtotal: parseFloat(order.subtotal || "0"),
      shippingTotal: parseFloat(order.shippingTotal || "0"),
      taxTotal: parseFloat(order.taxTotal || "0"),
      discountTotal: parseFloat(order.discountTotal || "0"),
      // Use payment status utility for consistent calculation
      ...(() => {
        const paymentInfo = computePaymentStatus({
          total: order.total,
          amountPaid: order.amountPaid,
          amountRefunded: order.amountRefunded,
        });
        return {
          total: paymentInfo.total,
          amountPaid: paymentInfo.amountPaid,
          amountRefunded: paymentInfo.amountRefunded,
          amountDue: paymentInfo.amountDue,
        };
      })(),
      currency: order.currencyCode || "AFN",
    },
  };

  return invoiceData;
}

/**
 * Generate PDF buffer from invoice data
 */
export async function generateInvoicePdf(
  invoiceData: InvoiceData
): Promise<ArrayBuffer> {
  const pdfBuffer = await renderToBuffer(
    <InvoiceDocument data={invoiceData} />
  );
  // Convert to ArrayBuffer by copying the data
  const arrayBuffer = new ArrayBuffer(pdfBuffer.byteLength);
  new Uint8Array(arrayBuffer).set(pdfBuffer);
  return arrayBuffer;
}

/**
 * Create a shareable invoice token
 */
export async function createInvoiceToken(
  orderId: string,
  tenantId: string,
  userId?: string,
  expiresInDays?: number
): Promise<string> {
  const token = generateInvoiceToken();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  await db.insert(orderInvoiceTokens).values({
    orderId,
    tenantId,
    token,
    expiresAt,
    createdBy: userId || null,
  });

  return token;
}

/**
 * Validate and get order from token
 */
export async function getOrderFromToken(token: string): Promise<{
  orderId: string;
  tenantId: string;
} | null> {
  const tokenRecord = await db.query.orderInvoiceTokens.findFirst({
    where: eq(orderInvoiceTokens.token, token),
  });

  if (!tokenRecord) return null;

  // Check expiration
  if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < new Date()) {
    return null;
  }

  // Update access tracking
  await db
    .update(orderInvoiceTokens)
    .set({
      accessCount: tokenRecord.accessCount + 1,
      lastAccessedAt: new Date().toISOString(),
    })
    .where(eq(orderInvoiceTokens.id, tokenRecord.id));

  return {
    orderId: tokenRecord.orderId,
    tenantId: tokenRecord.tenantId,
  };
}

/**
 * Get existing tokens for an order
 */
export async function getOrderTokens(orderId: string, tenantId: string) {
  return db.query.orderInvoiceTokens.findMany({
    where: and(
      eq(orderInvoiceTokens.orderId, orderId),
      eq(orderInvoiceTokens.tenantId, tenantId)
    ),
    orderBy: (tokens, { desc }) => [desc(tokens.createdAt)],
  });
}

/**
 * Delete an invoice token
 */
export async function deleteInvoiceToken(
  tokenId: string,
  tenantId: string
): Promise<boolean> {
  const result = await db
    .delete(orderInvoiceTokens)
    .where(
      and(
        eq(orderInvoiceTokens.id, tokenId),
        eq(orderInvoiceTokens.tenantId, tenantId)
      )
    );

  // Drizzle returns an array for delete operations
  return Array.isArray(result) ? result.length > 0 : true;
}

/**
 * Get shareable invoice URL
 */
export function getInvoiceUrl(token: string, baseUrl: string): string {
  return `${baseUrl}/invoice/${token}`;
}
