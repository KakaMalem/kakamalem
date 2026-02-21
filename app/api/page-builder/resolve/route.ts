import { NextRequest, NextResponse } from "next/server";
import { hasMinimumRole } from "@/lib/auth/context";
import {
  fetchProductsForGrid,
  getProductsByIds,
  getCategoriesByIds,
} from "@/lib/page-builder/resolve-products";
import type { ProductGridProps } from "@/lib/page-builder/types";

/**
 * POST /api/page-builder/resolve
 * Resolves section data for the Puck editor preview.
 * Used by resolveData callbacks in the editor config.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, type, params } = body;

    if (!tenantId || !type) {
      return NextResponse.json(
        { error: "Missing tenantId or type" },
        { status: 400 }
      );
    }

    // Auth: require at least staff role on this store
    const authorized = await hasMinimumRole(tenantId, "staff");
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    switch (type) {
      case "products": {
        const gridProps: ProductGridProps = {
          source: params?.source || "newest",
          productIds: params?.productIds || [],
          categoryId: params?.categoryId || "",
          limit: params?.limit || 8,
          title: "",
          columns: 4,
          showViewAll: false,
          cardStyle: "standard",
          imageAspectRatio: "square",
          showPrice: true,
          showBadge: true,
          cardBorderRadius: "md",
          cardShadow: "sm",
          hoverEffect: "lift",
          textAlign: "left",
        };
        const products = await fetchProductsForGrid(tenantId, gridProps);
        return NextResponse.json(products);
      }

      case "product": {
        if (!params?.productId) {
          return NextResponse.json(null);
        }
        const products = await getProductsByIds(tenantId, [params.productId]);
        return NextResponse.json(products[0] || null);
      }

      case "categories": {
        if (!params?.categoryIds?.length) {
          return NextResponse.json([]);
        }
        const categories = await getCategoriesByIds(
          tenantId,
          params.categoryIds
        );
        return NextResponse.json(categories);
      }

      default:
        return NextResponse.json(
          { error: `Unknown type: ${type}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[page-builder/resolve] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
