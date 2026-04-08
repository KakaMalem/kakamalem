"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Search,
  X,
  PackageCheck,
  PackageX,
  AlertTriangle,
  Filter,
  Layers,
  Package,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type Category = {
  id: string;
  name: string;
};

interface InventoryFiltersProps {
  categories: Category[];
  currentFilters: {
    search?: string;
    status?: string;
    categoryId?: string;
    hasVariants?: string;
  };
}

export function InventoryFilters({
  categories,
  currentFilters,
}: InventoryFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "" || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      // Reset to page 1 when filters change
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const clearAllFilters = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  const hasActiveFilters =
    currentFilters.search ||
    (currentFilters.status && currentFilters.status !== "all") ||
    currentFilters.categoryId ||
    currentFilters.hasVariants;

  const activeFilterCount = [
    currentFilters.search,
    currentFilters.status && currentFilters.status !== "all",
    currentFilters.categoryId,
    currentFilters.hasVariants,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Main Filter Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-50 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, SKU, or barcode..."
            defaultValue={currentFilters.search || ""}
            onChange={(e) => {
              // Debounce search
              const value = e.target.value;
              const timeoutId = setTimeout(() => {
                updateFilter("search", value);
              }, 300);
              return () => clearTimeout(timeoutId);
            }}
            className="pl-9 pr-9"
          />
          {currentFilters.search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
              onClick={() => updateFilter("search", null)}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        {/* Stock Status Filter */}
        <Select
          value={currentFilters.status || "all"}
          onValueChange={(value) => updateFilter("status", value)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Stock Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <Package className="size-4 text-muted-foreground" />
                All Status
              </div>
            </SelectItem>
            <SelectItem value="in_stock">
              <div className="flex items-center gap-2">
                <PackageCheck className="size-4 text-green-600" />
                In Stock
              </div>
            </SelectItem>
            <SelectItem value="low_stock">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-yellow-600" />
                Low Stock
              </div>
            </SelectItem>
            <SelectItem value="out_of_stock">
              <div className="flex items-center gap-2">
                <PackageX className="size-4 text-destructive" />
                Out of Stock
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Category Filter */}
        <Select
          value={currentFilters.categoryId || "all"}
          onValueChange={(value) =>
            updateFilter("categoryId", value === "all" ? null : value)
          }
        >
          <SelectTrigger className="w-45">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Advanced Filters Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="size-4" />
              More Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 size-5 p-0">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <h4 className="font-medium">Advanced Filters</h4>

              <Separator />

              {/* Product Type */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Product Type</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="simple-products"
                      checked={currentFilters.hasVariants === "false"}
                      onCheckedChange={(checked) =>
                        updateFilter("hasVariants", checked ? "false" : null)
                      }
                    />
                    <Label
                      htmlFor="simple-products"
                      className="flex items-center gap-2 text-sm font-normal cursor-pointer"
                    >
                      <Package className="size-4" />
                      Simple Products
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="variant-products"
                      checked={currentFilters.hasVariants === "true"}
                      onCheckedChange={(checked) =>
                        updateFilter("hasVariants", checked ? "true" : null)
                      }
                    />
                    <Label
                      htmlFor="variant-products"
                      className="flex items-center gap-2 text-sm font-normal cursor-pointer"
                    >
                      <Layers className="size-4" />
                      Products with Variants
                    </Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={clearAllFilters}
                >
                  <X className="mr-2 size-4" />
                  Clear All Filters
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Clear All - shown when filters are active */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            <X className="mr-1 size-4" />
            Clear All
          </Button>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {currentFilters.search && (
            <Badge variant="secondary" className="gap-1">
              Search: {currentFilters.search}
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 size-4 p-0 hover:bg-transparent"
                onClick={() => updateFilter("search", null)}
              >
                <X className="size-3" />
              </Button>
            </Badge>
          )}
          {currentFilters.status && currentFilters.status !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Status: {currentFilters.status.replace("_", " ")}
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 size-4 p-0 hover:bg-transparent"
                onClick={() => updateFilter("status", null)}
              >
                <X className="size-3" />
              </Button>
            </Badge>
          )}
          {currentFilters.categoryId && (
            <Badge variant="secondary" className="gap-1">
              Category:{" "}
              {categories.find((c) => c.id === currentFilters.categoryId)
                ?.name || "Unknown"}
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 size-4 p-0 hover:bg-transparent"
                onClick={() => updateFilter("categoryId", null)}
              >
                <X className="size-3" />
              </Button>
            </Badge>
          )}
          {currentFilters.hasVariants && (
            <Badge variant="secondary" className="gap-1">
              {currentFilters.hasVariants === "true"
                ? "With Variants"
                : "Simple Products"}
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 size-4 p-0 hover:bg-transparent"
                onClick={() => updateFilter("hasVariants", null)}
              >
                <X className="size-3" />
              </Button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
