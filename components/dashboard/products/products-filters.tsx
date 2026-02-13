"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Upload,
  Download,
  Globe,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  onBulkUploadClick?: () => void;
}

export function ProductsFilters({
  showArchived,
  storeSlug,
  onBulkUploadClick,
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
        {/* Import/Export Menu - Mobile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="size-9 shrink-0 sm:hidden"
            >
              <MoreVertical className="size-4" />
              <span className="sr-only">More actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a
                href={`/api/dashboard/${storeSlug}/products/export?format=csv${showArchived ? "&status=archived" : ""}`}
                download
              >
                <Download className="size-4" />
                Export as CSV
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a
                href={`/api/dashboard/${storeSlug}/products/export?format=xlsx${showArchived ? "&status=archived" : ""}`}
                download
              >
                <Download className="size-4" />
                Export as Excel
              </a>
            </DropdownMenuItem>
            {onBulkUploadClick && (
              <DropdownMenuItem onClick={onBulkUploadClick}>
                <Upload className="size-4" />
                Bulk Upload (CSV)
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/${storeSlug}/products/import`}>
                <Globe className="size-4" />
                Import from Amazon
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Add Product + Import/Export Buttons - Desktop */}
      <div className="hidden sm:flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="size-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a
                href={`/api/dashboard/${storeSlug}/products/export?format=csv${showArchived ? "&status=archived" : ""}`}
                download
              >
                Export as CSV
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a
                href={`/api/dashboard/${storeSlug}/products/export?format=xlsx${showArchived ? "&status=archived" : ""}`}
                download
              >
                Export as Excel
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Upload className="size-4" />
              Import
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onBulkUploadClick && (
              <DropdownMenuItem onClick={onBulkUploadClick}>
                <Upload className="size-4" />
                Bulk Upload (CSV)
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/${storeSlug}/products/import`}>
                <Globe className="size-4" />
                Import from Amazon
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button asChild>
          <Link href={`/dashboard/${storeSlug}/products/new`}>
            <Plus className="size-4" />
            Add Product
          </Link>
        </Button>
      </div>
    </div>
  );
}
