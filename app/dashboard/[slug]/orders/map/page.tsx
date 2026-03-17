import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import {
  getDashboardOrders,
  getOrderCounts,
  type OrderFilters,
  type OrderStatus,
  type OrderChannel,
} from "@/lib/db/queries/orders";
import { OrdersMapPageClient } from "@/components/dashboard/orders/orders-map-page-client";

interface OrdersMapPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    search?: string;
    status?: string;
    channel?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}

export default async function OrdersMapPage({
  params,
  searchParams,
}: OrdersMapPageProps) {
  const { slug } = await params;
  const search = await searchParams;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  // Build filters
  const filters: OrderFilters = {
    search: search.search,
    status: search.status as OrderStatus | "all" | undefined,
    channel: search.channel as OrderChannel | "all" | undefined,
    dateFrom: search.dateFrom,
    dateTo: search.dateTo,
  };

  // Fetch more orders for the map (up to 500 by default)
  const ordersResult = await getDashboardOrders(store.id, {
    page: 1,
    limit: 500,
    filters,
  });

  const orderCounts = await getOrderCounts(store.id);

  return (
    <OrdersMapPageClient
      storeSlug={slug}
      currency={store.currency}
      orders={ordersResult.orders}
      orderCounts={orderCounts}
      searchParams={search}
    />
  );
}
