import { notFound } from "next/navigation";
import { subDays } from "date-fns";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import {
  getStockSummary,
  getLowStockProducts,
  getStockByCategory,
  getInventoryProducts,
  getStockMovementTrends,
  getMovementsByType,
  type InventoryFilters,
} from "@/lib/db/queries/inventory";
import { getCategoriesWithCounts } from "@/lib/db/queries/categories";
import { InventoryPageClient } from "@/components/dashboard/inventory/inventory-page-client";

interface InventoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    status?: string;
    categoryId?: string;
    hasVariants?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export default async function InventoryPage({
  params,
  searchParams,
}: InventoryPageProps) {
  const { slug } = await params;
  const search = await searchParams;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  // Build filters from search params
  const filters: InventoryFilters = {
    page: search.page ? parseInt(search.page) : 1,
    limit: search.limit ? parseInt(search.limit) : 25,
    search: search.search || undefined,
    status: (search.status as InventoryFilters["status"]) || undefined,
    categoryId: search.categoryId || undefined,
    hasVariants:
      search.hasVariants === "true"
        ? true
        : search.hasVariants === "false"
          ? false
          : undefined,
    sortBy: (search.sortBy as InventoryFilters["sortBy"]) || "name",
    sortOrder: (search.sortOrder as InventoryFilters["sortOrder"]) || "asc",
  };

  // Calculate date range for trends (last 30 days)
  const endDate = new Date();
  const startDate = subDays(endDate, 30);

  // Fetch all data in parallel
  const [
    stockSummary,
    lowStockProducts,
    stockByCategory,
    inventoryData,
    categories,
    stockTrends,
    movementsByType,
  ] = await Promise.all([
    getStockSummary(store.id),
    getLowStockProducts(store.id, { limit: 20 }),
    getStockByCategory(store.id),
    getInventoryProducts(store.id, filters),
    getCategoriesWithCounts(store.id),
    getStockMovementTrends(store.id, {
      startDate,
      endDate,
      groupBy: "day",
    }),
    getMovementsByType(store.id, {
      startDate,
      endDate,
    }),
  ]);

  return (
    <InventoryPageClient
      tenantId={store.id}
      storeSlug={slug}
      storeName={store.name}
      currency={store.currency}
      initialProducts={inventoryData.products}
      initialPagination={inventoryData.pagination}
      stockSummary={stockSummary}
      lowStockProducts={lowStockProducts}
      stockByCategory={stockByCategory}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      stockTrends={stockTrends}
      movementsByType={movementsByType}
    />
  );
}
