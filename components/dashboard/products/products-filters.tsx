"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProductsFiltersProps {
  showArchived: boolean;
  currentSort?: {
    field: string;
    direction: string;
  };
  storeSlug: string;
}

export function ProductsFilters({
  showArchived,
  storeSlug,
}: ProductsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("search") || "");

  const updateParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());

    // Reset to page 1 when filters change
    params.set("page", "1");

    // Preserve limit if set (don't include default value)
    const currentLimit = searchParams.get("limit");
    if (currentLimit && currentLimit !== "25") {
      params.set("limit", currentLimit);
    }

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

  const handleToggle = (archived: boolean) => {
    updateParams({ status: archived ? "archived" : undefined });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-3">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 sm:max-w-xs">
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

        {/* Active/Archived Toggle */}
        <div className="relative z-0 inline-flex items-center gap-1 rounded-xl border border-border bg-background p-1">
          <button
            type="button"
            onClick={() => handleToggle(false)}
            disabled={isPending}
            className={cn(
              "relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              !showArchived
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => handleToggle(true)}
            disabled={isPending}
            className={cn(
              "relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              showArchived
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Archived
          </button>
        </div>
      </div>

      {/* Add Product Button - Desktop */}
      <Button asChild className="hidden sm:inline-flex">
        <Link href={`/dashboard/${storeSlug}/products/new`}>
          <Plus className="size-4" />
          Add Product
        </Link>
      </Button>
    </div>
  );
}
