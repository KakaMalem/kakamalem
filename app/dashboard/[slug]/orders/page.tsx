import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import {
  getDashboardOrders,
  getOrderCounts,
  type OrderFilters,
  type OrderSort,
  type OrderStatus,
  type OrderChannel,
} from "@/lib/db/queries/orders";
import { OrdersPageClient } from "@/components/dashboard/orders/orders-page-client";

interface OrdersPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    status?: string;
    channel?: string;
    dateRange?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
    order?: string;
  }>;
}

export default async function OrdersPage({
  params,
  searchParams,
}: OrdersPageProps) {
  const { slug } = await params;
  const search = await searchParams;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  // Parse search params
  const page = parseInt(search.page || "1");
  const limit = Math.min(Math.max(parseInt(search.limit || "25"), 25), 500);

  // Build filters
  const filters: OrderFilters = {
    search: search.search,
    status: search.status as OrderStatus | "all" | undefined,
    channel: search.channel as OrderChannel | "all" | undefined,
    dateFrom: search.dateFrom,
    dateTo: search.dateTo,
  };

  // Build sort
  const sort: OrderSort | undefined = search.sort
    ? {
        field: search.sort as "createdAt" | "total" | "status" | "orderNumber",
        direction: (search.order || "desc") as "asc" | "desc",
      }
    : undefined;

  // Fetch orders and counts in parallel
  const [ordersResult, orderCounts] = await Promise.all([
    getDashboardOrders(store.id, { page, limit, filters, sort }),
    getOrderCounts(store.id),
  ]);

  // Check if store supports offline sales (not online_only mode)
  const showRecordSale = store.storeMode !== "online_only";

  return (
    <OrdersPageClient
      storeSlug={slug}
      tenantId={store.id}
      currency={store.currency}
      orders={ordersResult.orders}
      pagination={ordersResult.pagination}
      searchParams={search}
      currentLimit={limit}
      orderCounts={orderCounts}
      showRecordSale={showRecordSale}
    />
  );
}
