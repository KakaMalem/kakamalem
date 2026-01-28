"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Package,
  PackageCheck,
  PackageX,
  AlertTriangle,
  History,
  Plus,
  Pencil,
  DollarSign,
  Layers,
  BarChart3,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { InventoryDataTable } from "./inventory-data-table";
import { InventoryFilters } from "./inventory-filters";
import { BulkAdjustDialog } from "./bulk-adjust-dialog";
import { StockMovementChart } from "./stock-movement-chart";
import { InventoryExport } from "./inventory-export";

import type {
  InventoryProduct,
  StockSummary,
  StockMovementTrend,
  MovementsByType,
  StockByCategory,
  LowStockProduct,
} from "@/lib/db/queries/inventory";

type Category = {
  id: string;
  name: string;
};

interface InventoryPageClientProps {
  tenantId: string;
  storeSlug: string;
  storeName: string;
  currency: string;
  initialProducts: InventoryProduct[];
  initialPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stockSummary: StockSummary;
  lowStockProducts: LowStockProduct[];
  stockByCategory: StockByCategory[];
  categories: Category[];
  stockTrends: StockMovementTrend[];
  movementsByType: MovementsByType[];
}

export function InventoryPageClient({
  tenantId,
  storeSlug,
  storeName,
  currency,
  initialProducts,
  initialPagination,
  stockSummary,
  lowStockProducts,
  stockByCategory,
  categories,
  stockTrends,
  movementsByType,
}: InventoryPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkAdjustOpen, setBulkAdjustOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("products");

  // Use props directly for server-side data
  const products = initialProducts;
  const pagination = initialPagination;

  // Get current filters from URL
  const currentFilters = {
    search: searchParams.get("search") || undefined,
    status: searchParams.get("status") || undefined,
    categoryId: searchParams.get("categoryId") || undefined,
    hasVariants: searchParams.get("hasVariants") || undefined,
  };

  // Update URL when page changes
  const handlePageChange = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(page));
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  // Update URL when page size changes
  const handlePageSizeChange = useCallback(
    (size: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("limit", String(size));
      params.delete("page"); // Reset to page 1
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M ${currency}`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K ${currency}`;
    }
    return `${value.toLocaleString()} ${currency}`;
  };

  // Calculate percentage changes for display
  const stockHealthScore =
    stockSummary.totalTrackedProducts > 0
      ? Math.round(
          (stockSummary.inStockCount / stockSummary.totalTrackedProducts) * 100
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">
            Monitor stock levels, track movements, and manage inventory.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/${storeSlug}/inventory/history`}>
              <History className="mr-2 size-4" />
              History
            </Link>
          </Button>
          {selectedProductIds.length > 0 && (
            <Button variant="secondary" onClick={() => setBulkAdjustOpen(true)}>
              <Pencil className="mr-2 size-4" />
              Bulk Adjust ({selectedProductIds.length})
            </Button>
          )}
          <Button asChild>
            <Link href={`/dashboard/${storeSlug}/inventory/adjust`}>
              <Plus className="mr-2 size-4" />
              Adjust Stock
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Products
            </CardTitle>
            <Package className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stockSummary.totalProducts}
            </div>
            <p className="text-xs text-muted-foreground">
              {stockSummary.totalTrackedProducts} tracked
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
              {stockSummary.inStockCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {stockHealthScore}% healthy
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
              {stockSummary.lowStockCount}
            </div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <PackageX className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {stockSummary.outOfStockCount}
            </div>
            <p className="text-xs text-muted-foreground">Urgent restock</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stock Value</CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stockSummary.totalStockValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stockSummary.totalStockUnits.toLocaleString()} units
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="products" className="gap-2">
            <Package className="size-4" />
            Products
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="size-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <AlertTriangle className="size-4" />
            Alerts
            {stockSummary.lowStockCount + stockSummary.outOfStockCount > 0 && (
              <Badge variant="destructive" className="ml-1 size-5 p-0">
                {stockSummary.lowStockCount + stockSummary.outOfStockCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          {/* Filters and Export */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <InventoryFilters
              categories={categories}
              currentFilters={currentFilters}
            />
            <InventoryExport
              products={products}
              currency={currency}
              storeName={storeName}
            />
          </div>

          {/* Data Table */}
          <InventoryDataTable
            data={products}
            tenantId={tenantId}
            storeSlug={storeSlug}
            currency={currency}
            pagination={pagination}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            onSelectionChange={setSelectedProductIds}
          />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          {/* Stock Movement Chart */}
          <StockMovementChart
            data={stockTrends}
            movementsByType={movementsByType}
          />

          {/* Stock by Category */}
          <Card>
            <CardHeader>
              <CardTitle>Stock by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {stockByCategory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Layers className="mb-2 size-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No category data available.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stockByCategory.map((category) => {
                    const total =
                      category.inStockCount +
                      category.lowStockCount +
                      category.outOfStockCount;
                    const inStockPercent =
                      total > 0 ? (category.inStockCount / total) * 100 : 0;
                    const lowStockPercent =
                      total > 0 ? (category.lowStockCount / total) * 100 : 0;
                    const outOfStockPercent =
                      total > 0 ? (category.outOfStockCount / total) * 100 : 0;

                    return (
                      <div
                        key={category.categoryId || "uncategorized"}
                        className="space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {category.categoryName || "Uncategorized"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {category.productCount} products ·{" "}
                              {category.totalStock.toLocaleString()} units
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
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="bg-green-500"
                            style={{ width: `${inStockPercent}%` }}
                          />
                          <div
                            className="bg-yellow-500"
                            style={{ width: `${lowStockPercent}%` }}
                          />
                          <div
                            className="bg-red-500"
                            style={{ width: `${outOfStockPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Low Stock Alerts */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-5 text-yellow-600" />
                  Low Stock Alerts
                </CardTitle>
                {lowStockProducts.filter((p) => p.stock > 0).length > 0 && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link
                      href={`/dashboard/${storeSlug}/products?stock=low_stock`}
                    >
                      View All
                    </Link>
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {lowStockProducts.filter((p) => p.stock > 0).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <PackageCheck className="mb-2 size-8 text-green-600" />
                    <p className="text-sm text-muted-foreground">
                      No low stock alerts!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lowStockProducts
                      .filter((p) => p.stock > 0)
                      .slice(0, 5)
                      .map((product) => (
                        <div
                          key={product.variantId || product.id}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/dashboard/${storeSlug}/products/${product.id}`}
                              className="font-medium hover:underline"
                            >
                              {product.name}
                            </Link>
                            {product.variantName && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                {product.variantName}
                              </Badge>
                            )}
                            <p className="text-sm text-muted-foreground">
                              {product.categoryName || "Uncategorized"}
                              {product.sku && ` · ${product.sku}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-yellow-600">
                              {product.stock}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              / {product.lowStockThreshold} min
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Out of Stock */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <PackageX className="size-5 text-destructive" />
                  Out of Stock
                </CardTitle>
                {lowStockProducts.filter((p) => p.stock === 0).length > 0 && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link
                      href={`/dashboard/${storeSlug}/products?stock=out_of_stock`}
                    >
                      View All
                    </Link>
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {lowStockProducts.filter((p) => p.stock === 0).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <PackageCheck className="mb-2 size-8 text-green-600" />
                    <p className="text-sm text-muted-foreground">
                      All products in stock!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lowStockProducts
                      .filter((p) => p.stock === 0)
                      .slice(0, 5)
                      .map((product) => (
                        <div
                          key={product.variantId || product.id}
                          className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/dashboard/${storeSlug}/products/${product.id}`}
                              className="font-medium hover:underline"
                            >
                              {product.name}
                            </Link>
                            {product.variantName && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                {product.variantName}
                              </Badge>
                            )}
                            <p className="text-sm text-muted-foreground">
                              {product.categoryName || "Uncategorized"}
                              {product.sku && ` · ${product.sku}`}
                            </p>
                          </div>
                          <Button size="sm" asChild>
                            <Link
                              href={`/dashboard/${storeSlug}/inventory/adjust?productId=${product.id}${product.variantId ? `&variantId=${product.variantId}` : ""}`}
                            >
                              <Plus className="mr-1 size-3" />
                              Restock
                            </Link>
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Bulk Adjust Dialog */}
      <BulkAdjustDialog
        open={bulkAdjustOpen}
        onOpenChange={setBulkAdjustOpen}
        tenantId={tenantId}
        selectedProductIds={selectedProductIds}
      />
    </div>
  );
}
