import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import {
  getStockSummary,
  getLowStockProducts,
  getStockByCategory,
} from "@/lib/db/queries/inventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  PackageCheck,
  PackageX,
  AlertTriangle,
  ArrowRight,
  History,
  Plus,
} from "lucide-react";

interface InventoryPageProps {
  params: Promise<{ slug: string }>;
}

export default async function InventoryPage({ params }: InventoryPageProps) {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const [summary, lowStockProducts, stockByCategory] = await Promise.all([
    getStockSummary(store.id),
    getLowStockProducts(store.id, { limit: 10 }),
    getStockByCategory(store.id),
  ]);

  const formatCurrency = (value: number) => {
    return `${value.toLocaleString()} ${store.currency}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">
            Monitor stock levels and manage inventory.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/${slug}/inventory/history`}>
              <History className="mr-2 size-4" />
              History
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/dashboard/${slug}/inventory/adjust`}>
              <Plus className="mr-2 size-4" />
              Adjust Stock
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Products
            </CardTitle>
            <Package className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              {summary.totalTrackedProducts} with inventory tracking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Stock</CardTitle>
            <PackageCheck className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {summary.inStockCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Products above threshold
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="size-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {summary.lowStockCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Products at or below threshold
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <PackageX className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {summary.outOfStockCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Products with zero stock
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stock Value Card */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Total Units</p>
              <p className="text-2xl font-bold">
                {summary.totalStockUnits.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estimated Value</p>
              <p className="text-2xl font-bold">
                {formatCurrency(summary.totalStockValue)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Low Stock Products */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Low Stock Alerts</CardTitle>
            {lowStockProducts.length > 0 && (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/dashboard/${slug}/products?stock=low_stock`}>
                  View All
                  <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <PackageCheck className="mb-2 size-8 text-green-600" />
                <p className="text-sm text-muted-foreground">
                  All products are well stocked!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/${slug}/products/${product.id}`}
                        className="font-medium hover:underline"
                      >
                        {product.name}
                      </Link>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {product.categoryName && (
                          <span>{product.categoryName}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-medium">{product.stock}</p>
                        <p className="text-xs text-muted-foreground">
                          / {product.lowStockThreshold} min
                        </p>
                      </div>
                      {product.stock === 0 ? (
                        <Badge variant="destructive">Out</Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-yellow-500 text-yellow-600"
                        >
                          Low
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Stock by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {stockByCategory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="mb-2 size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No products with inventory tracking yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {stockByCategory.map((category) => (
                  <div
                    key={category.categoryId || "uncategorized"}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">
                        {category.categoryName || "Uncategorized"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {category.productCount} product
                        {category.productCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {category.outOfStockCount > 0 && (
                        <Badge variant="destructive">
                          {category.outOfStockCount} out
                        </Badge>
                      )}
                      {category.lowStockCount > 0 && (
                        <Badge
                          variant="outline"
                          className="border-yellow-500 text-yellow-600"
                        >
                          {category.lowStockCount} low
                        </Badge>
                      )}
                      {category.inStockCount > 0 && (
                        <Badge
                          variant="outline"
                          className="border-green-500 text-green-600"
                        >
                          {category.inStockCount} ok
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
