"use server";

import {
  getProducts,
  type ProductFilters,
  type ProductSort,
} from "@/lib/db/queries/products";

export type FetchProductsResult = Awaited<ReturnType<typeof getProducts>>;

/**
 * Server action to fetch products for infinite scroll
 * Used by client components to load more products
 */
export async function fetchMoreProducts(
  tenantId: string,
  options: {
    page: number;
    limit: number;
    filters?: ProductFilters;
    sort?: ProductSort;
  }
): Promise<FetchProductsResult> {
  return getProducts(tenantId, options);
}
