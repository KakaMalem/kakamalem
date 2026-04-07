"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Archive, Trash2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STORAGE_KEY = "dashboard-products-limit";

interface ProductsBottomBarProps {
  storeSlug: string;
  pagination: {
    page: number;
    totalPages: number;
    total: number;
  };
  searchParams: Record<string, string | undefined>;
  currentLimit: number;
  selectedCount: number;
  selectionMode: boolean;
  onSelectionModeToggle: () => void;
  onClearSelection: () => void;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
  isArchiveView: boolean;
}

const LIMIT_OPTIONS = [25, 50, 100, 500] as const;

export function ProductsBottomBar({
  storeSlug,
  pagination,
  searchParams,
  currentLimit,
  selectedCount,
  selectionMode,
  onSelectionModeToggle,
  onClearSelection,
  onBulkArchive,
  onBulkDelete,
  isArchiveView,
}: ProductsBottomBarProps) {
  const router = useRouter();
  const urlSearchParams = useSearchParams();
  const hasAppliedStoredLimit = useRef(false);

  // Build URL with params
  const buildUrl = (updates: { page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    params.set("page", (updates.page ?? pagination.page).toString());
    const limit = updates.limit ?? currentLimit;
    if (limit !== 25) params.set("limit", limit.toString());
    if (searchParams.search) params.set("search", searchParams.search);
    if (searchParams.status) params.set("status", searchParams.status);
    if (searchParams.sort) params.set("sort", searchParams.sort);
    if (searchParams.order) params.set("order", searchParams.order);
    return `/dashboard/${storeSlug}/products?${params.toString()}`;
  };

  // On mount, apply stored limit if no limit in URL
  useEffect(() => {
    if (hasAppliedStoredLimit.current) return;
    hasAppliedStoredLimit.current = true;

    const urlHasLimit = urlSearchParams.has("limit");
    if (urlHasLimit) return;

    const storedLimit = localStorage.getItem(STORAGE_KEY);
    if (storedLimit) {
      const parsedLimit = parseInt(storedLimit, 10);
      if (
        LIMIT_OPTIONS.includes(parsedLimit as (typeof LIMIT_OPTIONS)[number]) &&
        parsedLimit !== 25
      ) {
        router.replace(buildUrl({ page: 1, limit: parsedLimit }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLimitChange = (newLimit: number) => {
    // Save preference to localStorage
    localStorage.setItem(STORAGE_KEY, newLimit.toString());
    // Reset to page 1 when limit changes
    router.push(buildUrl({ page: 1, limit: newLimit }));
  };

  const hasPrevious = pagination.page > 1;
  const hasNext = pagination.page < pagination.totalPages;

  return (
    <div className="pointer-events-none fixed bottom-4 left-0 z-50 w-full px-5 sm:px-4 md:left-64 md:w-[calc(100%-16rem)]">
      <div className="mx-auto max-w-3xl">
        <motion.div
          layout
          transition={{ duration: 0.15 }}
          className="pointer-events-auto overflow-hidden rounded-xl border bg-background shadow-lg"
        >
          {/* Sliding container */}
          <div className="relative overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              {!selectionMode ? (
                <motion.div
                  key="normal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                >
                  {/* Row 1: Product count + Limit + Pagination */}
                  <div className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="hidden sm:inline">Viewing</span>{" "}
                        <span className="font-medium text-foreground">
                          {pagination.total}
                        </span>{" "}
                        {pagination.total === 1 ? "product" : "products"}
                      </div>
                      <span className="text-border">|</span>
                      <div className="flex items-center gap-1.5">
                        <span className="hidden sm:inline">Show</span>
                        <Select
                          value={currentLimit.toString()}
                          onValueChange={(value) =>
                            handleLimitChange(Number(value))
                          }
                        >
                          <SelectTrigger
                            size="sm"
                            className="h-6 w-auto gap-1 px-2 py-0 text-sm font-medium"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent align="start">
                            {LIMIT_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt.toString()}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!hasPrevious}
                        onClick={() =>
                          hasPrevious &&
                          router.push(buildUrl({ page: pagination.page - 1 }))
                        }
                        className="flex h-7 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border bg-primary px-2.5 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-transparent disabled:bg-muted disabled:text-muted-foreground"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={!hasNext}
                        onClick={() =>
                          hasNext &&
                          router.push(buildUrl({ page: pagination.page + 1 }))
                        }
                        className="flex h-7 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border bg-primary px-2.5 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-transparent disabled:bg-muted disabled:text-muted-foreground"
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Add Product + Select */}
                  {/* Mobile: stacked full-width buttons */}
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

                  {/* Desktop: inline with pagination row */}
                  <div className="hidden items-center justify-between gap-2 border-t px-4 py-2 sm:flex">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onSelectionModeToggle}
                      className="h-7 gap-1.5"
                    >
                      <CheckCircle className="size-3.5" />
                      Select
                    </Button>
                    <Button asChild size="sm" className="h-7">
                      <Link href={`/dashboard/${storeSlug}/products/new`}>
                        <Plus className="size-3.5" />
                        Add Product
                      </Link>
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="selection"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
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
                        <motion.strong
                          key={selectedCount}
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.1 }}
                          className="inline-block font-semibold text-foreground"
                        >
                          {selectedCount}
                        </motion.strong>{" "}
                        selected
                      </span>
                    </div>
                    <AnimatePresence>
                      {selectedCount > 0 && (
                        <motion.div
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8 }}
                          transition={{ duration: 0.1 }}
                          className="flex items-center gap-2"
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
                            <span className="hidden min-[400px]:inline">
                              Delete
                            </span>
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
