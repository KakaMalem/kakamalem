import { notFound } from "next/navigation";
import { subDays } from "date-fns";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import {
  getInventoryMovements,
  getStockMovementTrends,
  getMovementsByType,
} from "@/lib/db/queries/inventory";
import { InventoryHistoryClient } from "@/components/dashboard/inventory/inventory-history-client";

interface InventoryHistoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    type?: string;
    productId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

export default async function InventoryHistoryPage({
  params,
  searchParams,
}: InventoryHistoryPageProps) {
  const { slug } = await params;
  const search = await searchParams;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const page = parseInt(search.page || "1");

  // Parse date filters
  const startDate = search.startDate ? new Date(search.startDate) : undefined;
  const endDate = search.endDate ? new Date(search.endDate) : undefined;

  // Calculate date range for trends (use filter dates or default to last 30 days)
  const trendEndDate = endDate || new Date();
  const trendStartDate = startDate || subDays(trendEndDate, 30);

  // Fetch data in parallel
  const [movementsData, stockTrends, movementsByType] = await Promise.all([
    getInventoryMovements(store.id, {
      page,
      limit: 20,
      type: search.type,
      productId: search.productId,
      startDate,
      endDate,
    }),
    getStockMovementTrends(store.id, {
      startDate: trendStartDate,
      endDate: trendEndDate,
      groupBy: "day",
    }),
    getMovementsByType(store.id, {
      startDate: trendStartDate,
      endDate: trendEndDate,
    }),
  ]);

  return (
    <InventoryHistoryClient
      storeSlug={slug}
      storeName={store.name}
      movements={movementsData.movements}
      pagination={movementsData.pagination}
      stockTrends={stockTrends}
      movementsByType={movementsByType}
      currentFilters={{
        type: search.type,
        productId: search.productId,
        search: search.search,
        startDate: search.startDate,
        endDate: search.endDate,
      }}
    />
  );
}
