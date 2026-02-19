import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/server";
import { canManageStore } from "@/lib/auth/context";
import {
  getDashboardOrders,
  getOrderCounts,
  type OrderFilters,
  type OrderSort,
  type OrderStatus,
  type OrderChannel,
} from "@/lib/db/queries/orders";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json(
      { error: "tenantId is required" },
      { status: 400 }
    );
  }

  const hasAccess = await canManageStore(tenantId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") || "25"), 25),
    500
  );

  const filters: OrderFilters = {
    search: searchParams.get("search") || undefined,
    status:
      (searchParams.get("status") as OrderStatus | "all" | undefined) ||
      undefined,
    channel:
      (searchParams.get("channel") as OrderChannel | "all" | undefined) ||
      undefined,
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
  };

  const sortField = searchParams.get("sort");
  const sort: OrderSort | undefined = sortField
    ? {
        field: sortField as "createdAt" | "total" | "status" | "orderNumber",
        direction: (searchParams.get("order") || "desc") as "asc" | "desc",
      }
    : undefined;

  const [ordersResult, orderCounts] = await Promise.all([
    getDashboardOrders(tenantId, { page, limit, filters, sort }),
    getOrderCounts(tenantId),
  ]);

  return NextResponse.json({
    orders: ordersResult.orders,
    pagination: ordersResult.pagination,
    orderCounts,
  });
}
