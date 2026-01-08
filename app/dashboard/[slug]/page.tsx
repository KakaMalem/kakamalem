import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import {
  getDashboardStats,
  getDailyMetrics,
  getTopProducts,
  getRecentOrders,
} from "@/lib/db/queries/analytics";
import { StatsCard } from "@/components/dashboard/stats-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { ActionableItems } from "@/components/dashboard/actionable-items";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { TopProducts } from "@/components/dashboard/top-products";
import {
  ShoppingCart,
  Package,
  DollarSign,
  CreditCard,
  TrendingUp,
} from "lucide-react";

interface StorePageProps {
  params: Promise<{ slug: string }>;
}

export default async function StoreDashboardPage({ params }: StorePageProps) {
  const { slug } = await params;
  const user = await getUser();
  const store = await getTenantBySlug(slug);

  if (!store) {
    notFound();
  }

  // Fetch all dashboard data in parallel
  const [stats, dailyMetrics, topProducts, recentOrders] = await Promise.all([
    getDashboardStats(store.id),
    getDailyMetrics(store.id, 7),
    getTopProducts(store.id, 30, 5),
    getRecentOrders(store.id, 5),
  ]);

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return `${num.toLocaleString()} ${store.currency}`;
  };

  // Get greeting based on time of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}, {firstName}!
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s how {store.name} is performing.
          </p>
        </div>
      </div>

      {/* KPI Cards - Top Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Today's Revenue"
          value={formatCurrency(stats.todayRevenue)}
          change={stats.revenueChange}
          subtitle="vs yesterday"
          icon={<DollarSign className="size-4" />}
        />
        <StatsCard
          title="Today's Orders"
          value={stats.todayOrders}
          change={stats.ordersChange}
          subtitle="vs yesterday"
          icon={<ShoppingCart className="size-4" />}
        />
        <StatsCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          subtitle="all time"
          icon={<TrendingUp className="size-4" />}
        />
        <StatsCard
          title="Total Orders"
          value={stats.totalOrders}
          subtitle={`${stats.totalProducts} products`}
          icon={<Package className="size-4" />}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Charts and Orders (2/3 width) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Revenue Chart */}
          <RevenueChart data={dailyMetrics} currency={store.currency} />

          {/* Recent Orders */}
          <RecentOrders
            orders={recentOrders}
            currency={store.currency}
            storeSlug={slug}
          />
        </div>

        {/* Right Column - Sidebar (1/3 width) */}
        <div className="space-y-6">
          {/* Actionable Items */}
          <ActionableItems
            storeSlug={slug}
            ordersToShip={stats.ordersToShip}
            lowStockProducts={stats.lowStockProducts}
            unrepliedReviews={stats.unrepliedReviews}
          />

          {/* Top Products */}
          <TopProducts
            products={topProducts}
            currency={store.currency}
            storeSlug={slug}
          />

          {/* Commission Status (SaaS Layer) */}
          <div className="rounded-lg border bg-linear-to-br from-primary/5 to-primary/10 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CreditCard className="size-4" />
              Commission Status
            </div>
            <div className="mt-2">
              <p className="text-2xl font-bold">Free Tier</p>
              <p className="text-sm text-muted-foreground">
                0 / 10,000 {store.currency} threshold
              </p>
              <div className="mt-2 h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: "0%" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
