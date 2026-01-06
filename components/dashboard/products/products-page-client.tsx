"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ProductsFilters } from "./products-filters";
import { ProductsList } from "./products-list";
import { ProductsBottomBar } from "./products-bottom-bar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { ProductWithCategory } from "@/lib/db/queries/products";
import {
  bulkDeleteProducts,
  bulkActivateProducts,
  bulkDeactivateProducts,
} from "@/lib/supabase/products";

interface ProductsPageClientProps {
  storeSlug: string;
  tenantId: string;
  currency: string;
  products: ProductWithCategory[];
  pagination: {
    page: number;
    totalPages: number;
    total: number;
  };
  searchParams: Record<string, string | undefined>;
  showArchived: boolean;
}

export function ProductsPageClient({
  storeSlug,
  tenantId,
  currency,
  products,
  pagination,
  searchParams,
  showArchived,
}: ProductsPageClientProps) {
  const router = useRouter();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  // Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Handle selection change from ProductsList
  const handleSelectionChange = useCallback((ids: Set<string>) => {
    setSelectedIds(ids);
  }, []);

  // Toggle selection mode (for mobile)
  const handleSelectionModeToggle = useCallback(() => {
    setSelectionMode((prev) => !prev);
    if (selectionMode) {
      // Exiting selection mode, clear selections
      setSelectedIds(new Set());
    }
  }, [selectionMode]);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, []);

  // Bulk archive/restore
  const handleBulkArchive = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const productIds = Array.from(selectedIds);

    // If viewing archived, restore (activate), else archive (deactivate)
    const result = showArchived
      ? await bulkActivateProducts(tenantId, productIds)
      : await bulkDeactivateProducts(tenantId, productIds);

    if (result.success) {
      toast.success(
        showArchived
          ? `${productIds.length} product${
              productIds.length > 1 ? "s" : ""
            } restored`
          : `${productIds.length} product${
              productIds.length > 1 ? "s" : ""
            } archived`
      );
      setSelectedIds(new Set());
      setSelectionMode(false);
      router.refresh();
    } else {
      toast.error(result.error?.message || "Failed to update products");
    }
  }, [selectedIds, showArchived, tenantId, router]);

  // Bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setIsDeleting(true);
    const productIds = Array.from(selectedIds);

    const result = await bulkDeleteProducts(tenantId, productIds);

    if (result.success) {
      toast.success(
        `${productIds.length} product${
          productIds.length > 1 ? "s" : ""
        } deleted`
      );
      setDeleteDialogOpen(false);
      setSelectedIds(new Set());
      setSelectionMode(false);
      router.refresh();
    } else {
      toast.error(result.error?.message || "Failed to delete products");
    }

    setIsDeleting(false);
  }, [selectedIds, tenantId, router]);

  return (
    <>
      <div className="space-y-4 pb-36">
        {/* Filters */}
        <ProductsFilters showArchived={showArchived} storeSlug={storeSlug} />

        {/* Products List */}
        <ProductsList
          products={products}
          storeSlug={storeSlug}
          currency={currency}
          tenantId={tenantId}
          selectedIds={selectedIds}
          onSelectionChange={handleSelectionChange}
          selectionMode={selectionMode}
        />
      </div>

      {/* Bottom Bar */}
      <ProductsBottomBar
        storeSlug={storeSlug}
        pagination={pagination}
        searchParams={searchParams}
        selectedCount={selectedIds.size}
        selectionMode={selectionMode}
        onSelectionModeToggle={handleSelectionModeToggle}
        onClearSelection={handleClearSelection}
        onBulkArchive={handleBulkArchive}
        onBulkDelete={() => setDeleteDialogOpen(true)}
        isArchiveView={showArchived}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.size} Product{selectedIds.size > 1 ? "s" : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} product
              {selectedIds.size > 1 ? "s" : ""}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
