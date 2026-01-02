"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category } from "@/lib/db/schema";

interface ProductsFiltersProps {
  categories: Category[];
  currentFilters: {
    search?: string;
    categoryId?: string;
    isActive?: boolean;
    stockStatus?: string;
  };
  currentSort?: {
    field: string;
    direction: string;
  };
  storeSlug: string;
}

export function ProductsFilters({
  categories,
  currentFilters,
  currentSort,
  storeSlug,
}: ProductsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(currentFilters.search || "");

  const updateParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());

    // Reset to page 1 when filters change
    params.set("page", "1");

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    startTransition(() => {
      router.push(`/dashboard/${storeSlug}/products?${params.toString()}`);
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ search: search || undefined });
  };

  const clearFilters = () => {
    setSearch("");
    startTransition(() => {
      router.push(`/dashboard/${storeSlug}/products`);
    });
  };

  const hasFilters =
    currentFilters.search ||
    currentFilters.categoryId ||
    currentFilters.isActive !== undefined ||
    currentFilters.stockStatus;

  const statusValue =
    currentFilters.isActive === true
      ? "active"
      : currentFilters.isActive === false
      ? "draft"
      : "all";

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </form>

      {/* Category Filter */}
      <Select
        value={currentFilters.categoryId || "all"}
        onValueChange={(value) =>
          updateParams({ category: value === "all" ? undefined : value })
        }
      >
        <SelectTrigger className="w-full sm:w-45">
          <SelectValue placeholder="All Categories" />
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

      {/* Status Filter */}
      <Select
        value={statusValue}
        onValueChange={(value) =>
          updateParams({ status: value === "all" ? undefined : value })
        }
      >
        <SelectTrigger className="w-full sm:w-35">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
        </SelectContent>
      </Select>

      {/* Stock Filter */}
      <Select
        value={currentFilters.stockStatus || "all"}
        onValueChange={(value) =>
          updateParams({ stock: value === "all" ? undefined : value })
        }
      >
        <SelectTrigger className="w-full sm:w-37.5">
          <SelectValue placeholder="All Stock" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Stock</SelectItem>
          <SelectItem value="in_stock">In Stock</SelectItem>
          <SelectItem value="low_stock">Low Stock</SelectItem>
          <SelectItem value="out_of_stock">Out of Stock</SelectItem>
        </SelectContent>
      </Select>

      {/* Sort */}
      <Select
        value={
          currentSort
            ? `${currentSort.field}-${currentSort.direction}`
            : "createdAt-desc"
        }
        onValueChange={(value) => {
          const [field, order] = value.split("-");
          updateParams({ sort: field, order });
        }}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="createdAt-desc">Newest First</SelectItem>
          <SelectItem value="createdAt-asc">Oldest First</SelectItem>
          <SelectItem value="name-asc">Name A-Z</SelectItem>
          <SelectItem value="name-desc">Name Z-A</SelectItem>
          <SelectItem value="price-asc">Price Low-High</SelectItem>
          <SelectItem value="price-desc">Price High-Low</SelectItem>
          <SelectItem value="stock-asc">Stock Low-High</SelectItem>
          <SelectItem value="stock-desc">Stock High-Low</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          disabled={isPending}
        >
          <X className="size-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
