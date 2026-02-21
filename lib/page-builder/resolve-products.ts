import {
  getProductsByIds,
  getCategoriesByIds,
} from "@/lib/db/queries/page-layouts";
import { getProducts } from "@/lib/db/queries/products";
import type { ProductGridProps, ResolvedProduct } from "./types";

/**
 * Fetch products for a ProductGrid section based on its source mode.
 * Shared between StorefrontRenderer (RSC) and the editor resolve API route.
 */
export async function fetchProductsForGrid(
  tenantId: string,
  props: ProductGridProps
): Promise<ResolvedProduct[]> {
  const limit = props.limit || 8;

  switch (props.source) {
    case "newest": {
      const result = await getProducts(tenantId, {
        page: 1,
        limit,
        filters: { isActive: true, showOnStorefront: true },
        sort: { field: "createdAt", direction: "desc" },
      });
      return mapProductResults(result.products);
    }

    case "all": {
      const result = await getProducts(tenantId, {
        page: 1,
        limit,
        filters: { isActive: true, showOnStorefront: true },
        sort: { field: "displayOrder", direction: "asc" },
      });
      return mapProductResults(result.products);
    }

    case "category": {
      if (!props.categoryId) return [];
      const result = await getProducts(tenantId, {
        page: 1,
        limit,
        filters: {
          isActive: true,
          showOnStorefront: true,
          categoryId: props.categoryId,
        },
        sort: { field: "displayOrder", direction: "asc" },
      });
      return mapProductResults(result.products);
    }

    case "on_sale": {
      const result = await getProducts(tenantId, {
        page: 1,
        limit: 50,
        filters: { isActive: true, showOnStorefront: true },
        sort: { field: "createdAt", direction: "desc" },
      });
      return mapProductResults(result.products)
        .filter(
          (p) =>
            p.compareAtPrice &&
            parseFloat(p.compareAtPrice) > parseFloat(p.price)
        )
        .slice(0, limit);
    }

    case "manual": {
      if (!props.productIds || props.productIds.length === 0) return [];
      return getProductsByIds(tenantId, props.productIds);
    }

    default:
      return [];
  }
}

/** Map getProducts result to ResolvedProduct format */
export function mapProductResults(
  products: Awaited<ReturnType<typeof getProducts>>["products"]
): ResolvedProduct[] {
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    compareAtPrice: null,
    imageUrl: p.image?.url ?? null,
    imageAlt: p.image?.altText ?? null,
    secondImageUrl: null,
    hasVariants: p.hasVariants,
    minVariantPrice: p.minVariantPrice,
    maxVariantPrice: p.maxVariantPrice,
  }));
}

// Re-export for convenience
export { getProductsByIds, getCategoriesByIds };
