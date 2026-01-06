"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X, Archive, Trash2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProductsBottomBarProps {
  storeSlug: string;
  pagination: {
    page: number;
    totalPages: number;
    total: number;
  };
  searchParams: Record<string, string | undefined>;
  selectedCount: number;
  selectionMode: boolean;
  onSelectionModeToggle: () => void;
  onClearSelection: () => void;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
  isArchiveView: boolean;
}

export function ProductsBottomBar({
  storeSlug,
  pagination,
  searchParams,
  selectedCount,
  selectionMode,
  onSelectionModeToggle,
  onClearSelection,
  onBulkArchive,
  onBulkDelete,
  isArchiveView,
}: ProductsBottomBarProps) {
  const router = useRouter();

  // Build pagination URL
  const buildPageUrl = (page: number) => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    if (searchParams.search) params.set("search", searchParams.search);
    if (searchParams.status) params.set("status", searchParams.status);
    if (searchParams.sort) params.set("sort", searchParams.sort);
    if (searchParams.order) params.set("order", searchParams.order);
    return `/dashboard/${storeSlug}/products?${params.toString()}`;
  };

  const hasPrevious = pagination.page > 1;
  const hasNext = pagination.page < pagination.totalPages;

  return (
    <div className="fixed bottom-4 left-0 z-50 w-full px-5 sm:px-4 md:left-64 md:w-[calc(100%-16rem)]">
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-xl border bg-background shadow-lg">
          {/* Sliding container */}
          <div className="relative overflow-hidden">
            {/* Normal view - slides up when selection mode is active */}
            <div
              className={cn(
                "transition-all duration-200 ease-out",
                selectionMode
                  ? "pointer-events-none absolute inset-x-0 -translate-y-full opacity-0"
                  : "translate-y-0 opacity-100"
              )}
            >
              {/* Row 1: Product count + Pagination */}
              <div className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline">Viewing</span>{" "}
                  <span className="font-medium text-foreground">
                    {pagination.total}
                  </span>{" "}
                  {pagination.total === 1 ? "product" : "products"}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!hasPrevious}
                    onClick={() =>
                      hasPrevious &&
                      router.push(buildPageUrl(pagination.page - 1))
                    }
                    className="flex h-7 items-center justify-center gap-2 whitespace-nowrap rounded-md border bg-background px-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:border-muted disabled:bg-muted/50 disabled:text-muted-foreground/50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={!hasNext}
                    onClick={() =>
                      hasNext && router.push(buildPageUrl(pagination.page + 1))
                    }
                    className="flex h-7 items-center justify-center gap-2 whitespace-nowrap rounded-md border bg-background px-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:border-muted disabled:bg-muted/50 disabled:text-muted-foreground/50"
                  >
                    Next
                  </button>
                </div>
              </div>

              {/* Row 2: Mobile only - Add Product + Select */}
              <div className="flex items-center gap-2 px-4 pb-3 pt-1 sm:hidden">
                <Button asChild className="h-8 flex-1">
                  <Link href={`/dashboard/${storeSlug}/products/new`}>
                    <Plus className="size-4" />
                    Add Product
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={onSelectionModeToggle}
                  className="h-8 gap-2 px-3"
                >
                  <CheckCircle className="size-4" />
                  Select
                </Button>
              </div>
            </div>

            {/* Selection mode view - slides up from below */}
            <div
              className={cn(
                "transition-all duration-200 ease-out",
                selectionMode
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none absolute inset-x-0 translate-y-full opacity-0"
              )}
            >
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClearSelection}
                    className="rounded-md p-1.5 transition-colors hover:bg-muted"
                  >
                    <X className="size-4" />
                  </button>
                  <span className="whitespace-nowrap text-sm text-muted-foreground">
                    <strong className="font-semibold text-foreground">
                      {selectedCount}
                    </strong>{" "}
                    selected
                  </span>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-2 transition-all duration-150",
                    selectedCount === 0
                      ? "pointer-events-none translate-y-1 opacity-0"
                      : "translate-y-0 opacity-100"
                  )}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onBulkArchive}
                    disabled={selectedCount === 0}
                    className="h-7 gap-1.5 px-2 text-xs"
                  >
                    <Archive className="size-3.5" />
                    <span className="hidden min-[400px]:inline">
                      {isArchiveView ? "Restore" : "Archive"}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onBulkDelete}
                    disabled={selectedCount === 0}
                    className="h-7 gap-1.5 px-2 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="size-3.5" />
                    <span className="hidden min-[400px]:inline">Delete</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
