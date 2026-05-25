import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  products,
  productVariants,
  categories,
  tenants,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUser, hasStoreAccess } from "@/lib/auth/server";

/**
 * GET /api/dashboard/[slug]/pos/sync
 *
 * Returns all POS-visible products, variants, categories, and store settings
 * for offline caching. This endpoint is used for initial seeding and periodic sync.
 *
 * Query params:
 * - lastSyncedAt: ISO timestamp for delta sync (optional, future use)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    // Note: lastSyncedAt parameter reserved for future delta sync support
    // const { searchParams } = new URL(request.url);
    // const lastSyncedAt = searchParams.get("lastSyncedAt");

    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get tenant by slug with settings
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
      columns: {
        id: true,
        name: true,
        currency: true,
        contactPhone: true,
        receiptFooterText: true,
        posScannerMode: true,
        receiptPrintMode: true,
        receiptPaperWidth: true,
        storeMode: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Check store access
    const access = await hasStoreAccess(tenant.id);
    if (!access) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch all active POS products with variants and images
    const productList = await db.query.products.findMany({
      where: and(
        eq(products.tenantId, tenant.id),
        eq(products.status, "active"),
        eq(products.showOnPos, true)
      ),
      columns: {
        id: true,
        name: true,
        price: true,
        stock: true,
        sku: true,
        barcode: true,
        trackInventory: true,
        hasVariants: true,
        categoryId: true,
      },
      with: {
        images: {
          columns: { id: true },
          with: {
            media: {
              columns: { url: true },
            },
          },
          limit: 1,
          orderBy: (pi, { asc }) => [asc(pi.position)],
        },
        variants: {
          where: eq(productVariants.isActive, true),
          columns: {
            id: true,
            displayName: true,
            sku: true,
            barcode: true,
            price: true,
            stock: true,
          },
          with: {
            image: {
              columns: { url: true },
            },
          },
          orderBy: (v, { asc }) => [asc(v.displayOrder)],
        },
        productCategories: {
          columns: {},
          with: {
            category: {
              columns: { id: true },
            },
          },
        },
      },
      orderBy: (p, { asc }) => [asc(p.displayOrder)],
    });

    // Fetch all categories with product counts
    const categoryList = await db.query.categories.findMany({
      where: eq(categories.tenantId, tenant.id),
      columns: {
        id: true,
        name: true,
        displayOrder: true,
      },
      with: {
        image: {
          columns: { url: true },
        },
      },
      orderBy: (c, { asc }) => [asc(c.displayOrder)],
    });

    // Count products per category (only POS-visible active products)
    const categoryCounts = new Map<string, number>();
    for (const product of productList) {
      // Count direct category
      if (product.categoryId) {
        categoryCounts.set(
          product.categoryId,
          (categoryCounts.get(product.categoryId) || 0) + 1
        );
      }
      // Count many-to-many categories
      for (const pc of product.productCategories) {
        if (pc.category?.id) {
          categoryCounts.set(
            pc.category.id,
            (categoryCounts.get(pc.category.id) || 0) + 1
          );
        }
      }
    }

    // Transform products to offline format
    const offlineProducts = productList.map((p) => ({
      id: p.id,
      tenantId: tenant.id,
      name: p.name,
      price: p.price,
      sku: p.sku,
      barcode: p.barcode,
      stock: p.stock ?? 0,
      trackInventory: p.trackInventory,
      hasVariants: p.hasVariants,
      categoryId: p.categoryId,
      categoryIds: p.productCategories
        .map((pc) => pc.category?.id)
        .filter((id): id is string => !!id),
      imageUrl: p.images[0]?.media?.url ?? null,
      showOnPos: true,
      lastSyncedAt: new Date().toISOString(),
    }));

    // Transform variants to offline format
    const offlineVariants = productList.flatMap((p) =>
      p.variants.map((v) => ({
        id: v.id,
        productId: p.id,
        tenantId: tenant.id,
        displayName: v.displayName ?? "",
        sku: v.sku,
        barcode: v.barcode,
        price: v.price,
        stock: v.stock ?? 0,
        isActive: true,
        imageUrl: v.image?.url ?? null,
      }))
    );

    // Transform categories to offline format
    const offlineCategories = categoryList.map((c) => ({
      id: c.id,
      tenantId: tenant.id,
      name: c.name,
      displayOrder: c.displayOrder ?? 0,
      imageUrl: c.image?.url ?? null,
      productCount: categoryCounts.get(c.id) || 0,
    }));

    // Store settings for offline use
    const storeSettings = {
      tenantId: tenant.id,
      storeName: tenant.name,
      currency: tenant.currency ?? "AFN",
      storePhone: tenant.contactPhone,
      receiptFooterText: tenant.receiptFooterText,
      posScannerMode: tenant.posScannerMode ?? "camera",
      receiptPrintMode: tenant.receiptPrintMode ?? "dialog",
      receiptPaperWidth: tenant.receiptPaperWidth ?? "58mm",
      storeMode: tenant.storeMode ?? "full",
      lastSyncedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: {
        products: offlineProducts,
        variants: offlineVariants,
        categories: offlineCategories,
        storeSettings,
      },
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("POS sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync POS data" },
      { status: 500 }
    );
  }
}
