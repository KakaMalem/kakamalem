import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, tenants } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { canManageStore } from "@/lib/auth/context";
import { getUser } from "@/lib/auth/server";
import {
  createInvoiceToken,
  getOrderTokens,
  deleteInvoiceToken,
  getInvoiceUrl,
} from "@/lib/invoice";

// =============================================================================
// INVOICE SHARE LINK API
// =============================================================================
// POST: Create a shareable invoice link
// GET: Get existing shareable links for an order
// DELETE: Remove a shareable link
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; orderId: string }> }
) {
  try {
    const { slug, orderId } = await params;

    // Get tenant by slug
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
      columns: { id: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Verify user can manage this store
    const canManage = await canManageStore(tenant.id);
    if (!canManage) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Verify order exists
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.tenantId, tenant.id)),
      columns: { id: true, orderNumber: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Get current user
    const user = await getUser();

    // Parse request body for options
    const body = await request.json().catch(() => ({}));
    const expiresInDays = body.expiresInDays || 7; // Default 7 days

    // Create shareable token
    const token = await createInvoiceToken(
      orderId,
      tenant.id,
      user?.id,
      expiresInDays
    );

    // Build shareable URL using configured app URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${new URL(request.url).protocol}//${new URL(request.url).host}`;
    const shareUrl = getInvoiceUrl(token, baseUrl);

    return NextResponse.json({
      success: true,
      token,
      url: shareUrl,
      expiresInDays,
      orderNumber: order.orderNumber,
    });
  } catch (error) {
    console.error("Create invoice share link error:", error);
    return NextResponse.json(
      { error: "Failed to create share link" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; orderId: string }> }
) {
  try {
    const { slug, orderId } = await params;

    // Get tenant by slug
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
      columns: { id: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Verify user can manage this store
    const canManage = await canManageStore(tenant.id);
    if (!canManage) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get existing tokens
    const tokens = await getOrderTokens(orderId, tenant.id);
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${new URL(request.url).protocol}//${new URL(request.url).host}`;

    return NextResponse.json({
      tokens: tokens.map((t) => ({
        id: t.id,
        token: t.token,
        url: getInvoiceUrl(t.token, baseUrl),
        expiresAt: t.expiresAt,
        accessCount: t.accessCount,
        lastAccessedAt: t.lastAccessedAt,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get invoice tokens error:", error);
    return NextResponse.json(
      { error: "Failed to get share links" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; orderId: string }> }
) {
  try {
    const { slug } = await params;

    // Get token ID from body
    const { tokenId } = await request.json();
    if (!tokenId) {
      return NextResponse.json({ error: "Token ID required" }, { status: 400 });
    }

    // Get tenant by slug
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
      columns: { id: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Verify user can manage this store
    const canManage = await canManageStore(tenant.id);
    if (!canManage) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete token
    const deleted = await deleteInvoiceToken(tokenId, tenant.id);

    if (!deleted) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete invoice token error:", error);
    return NextResponse.json(
      { error: "Failed to delete share link" },
      { status: 500 }
    );
  }
}
