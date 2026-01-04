"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  GripVertical,
  Pencil,
  Trash2,
  Package,
  Eye,
  PackagePlus,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  deleteProduct,
  reorderProducts,
  bulkDeleteProducts,
} from "@/lib/supabase/products";
import { QuickAdjustDialog } from "@/components/dashboard/inventory/quick-adjust-dialog";

interface ProductsListProps {
  tenantId: string;
  storeSlug: string;
  currency: string;
  products: ProductWithCategory[];
}

export function ProductsList({
  tenantId,
  storeSlug,
  currency,
  products: initialProducts,
}: ProductsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [products, setProducts] = useState(initialProducts);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] =
    useState<ProductWithCategory | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Quick adjust dialog state
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [productToAdjust, setProductToAdjust] =
    useState<ProductWithCategory | null>(null);

  // Drag state (mouse)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Touch drag state
  const [touchDragIndex, setTouchDragIndex] = useState<number | null>(null);
  const [touchOverIndex, setTouchOverIndex] = useState<number | null>(null);
  const touchStartY = useRef<number>(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Save reordered products
  const saveOrder = useCallback(
    async (newProducts: ProductWithCategory[]) => {
      const result = await reorderProducts(tenantId, {
        productIds: newProducts.map((p) => p.id),
      });

      if (result.success) {
        toast.success("Products reordered");
        startTransition(() => router.refresh());
      } else {
        setProducts(initialProducts);
        toast.error(result.error?.message || "Failed to reorder");
      }
    },
    [tenantId, initialProducts, router]
  );

  // Mouse drag handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = async () => {
    if (draggedIndex !== null && dragOverIndex !== null) {
      const newProducts = [...products];
      const [draggedItem] = newProducts.splice(draggedIndex, 1);
      newProducts.splice(dragOverIndex, 0, draggedItem);
      setProducts(newProducts);
      await saveOrder(newProducts);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Touch drag handlers
  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    // Only start drag if touching the grip handle
    const target = e.target as HTMLElement;
    if (!target.closest("[data-drag-handle]")) return;

    e.preventDefault();
    setTouchDragIndex(index);
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchDragIndex === null) return;

    const touchY = e.touches[0].clientY;

    // Find which item we're over
    for (let i = 0; i < itemRefs.current.length; i++) {
      const ref = itemRefs.current[i];
      if (ref) {
        const rect = ref.getBoundingClientRect();
        if (touchY >= rect.top && touchY <= rect.bottom) {
          if (i !== touchDragIndex) {
            setTouchOverIndex(i);
          }
          break;
        }
      }
    }
  };

  const handleTouchEnd = async () => {
    if (touchDragIndex !== null && touchOverIndex !== null) {
      const newProducts = [...products];
      const [draggedItem] = newProducts.splice(touchDragIndex, 1);
      newProducts.splice(touchOverIndex, 0, draggedItem);
      setProducts(newProducts);
      await saveOrder(newProducts);
    }

    setTouchDragIndex(null);
    setTouchOverIndex(null);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;

    const result = await deleteProduct(tenantId, productToDelete.id);

    if (result.success) {
      toast.success("Product deleted");
      setDeleteDialogOpen(false);
      setProductToDelete(null);
      // Optimistic update - remove from list immediately
      setProducts((prev) => prev.filter((p) => p.id !== productToDelete.id));
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to delete product");
    }
  };

  // Toggle selection for a single product
  const toggleSelection = (productId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    setIsBulkDeleting(true);
    const productIds = Array.from(selectedIds);

    const result = await bulkDeleteProducts(tenantId, productIds);

    if (result.success) {
      toast.success(
        `${productIds.length} product${
          productIds.length > 1 ? "s" : ""
        } deleted`
      );
      setBulkDeleteDialogOpen(false);
      // Optimistic update - remove from list immediately
      setProducts((prev) => prev.filter((p) => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to delete products");
    }

    setIsBulkDeleting(false);
  };

  const formatPrice = (price: string) => {
    return `${parseFloat(price).toLocaleString()} ${currency}`;
  };

  const getStockBadge = (product: ProductWithCategory) => {
    if (!product.trackInventory) {
      return (
        <Badge variant="secondary" className="text-muted-foreground">
          Not Tracked
        </Badge>
      );
    }

    // Out of stock
    if (product.stock === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }

    // Low stock (only if threshold is set and stock is below it)
    if (
      product.lowStockThreshold > 0 &&
      product.stock <= product.lowStockThreshold
    ) {
      return (
        <Badge variant="outline" className="border-yellow-500 text-yellow-600">
          Low Stock
        </Badge>
      );
    }

    // In stock (stock > 0 and either no threshold or stock > threshold)
    return (
      <Badge variant="outline" className="border-green-500 text-green-600">
        In Stock
      </Badge>
    );
  };

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="mb-4 size-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-medium">No products yet</h3>
          <p className="mb-4 text-center text-muted-foreground">
            Create products to start selling in your store.
          </p>
          <Button asChild>
            <Link href={`/dashboard/${storeSlug}/products/new`}>
              Add your first product
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const allSelected =
    products.length > 0 && selectedIds.size === products.length;

  return (
    <>
      {/* Bulk Actions Header */}
      {selectedIds.size > 0 && (
        <Card className="mb-4 border-primary">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all products"
              />
              <span className="font-medium">
                {selectedIds.size} product{selectedIds.size > 1 ? "s" : ""}{" "}
                selected
              </span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteDialogOpen(true)}
              disabled={isBulkDeleting}
            >
              <Trash2 className="mr-2 size-4" />
              Delete Selected
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {products.map((product, index) => {
          const isDragging = draggedIndex === index || touchDragIndex === index;
          const isDragOver =
            dragOverIndex === index || touchOverIndex === index;

          return (
            <Card
              key={product.id}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e, index)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className={`transition-all ${
                isDragging ? "opacity-50 scale-[1.02] shadow-lg" : ""
              } ${
                isDragOver
                  ? "border-primary ring-2 ring-primary ring-offset-2"
                  : ""
              }`}
            >
              <CardContent className="flex items-center gap-4 p-4">
                {/* Checkbox */}
                <Checkbox
                  checked={selectedIds.has(product.id)}
                  onCheckedChange={() => toggleSelection(product.id)}
                  aria-label={`Select ${product.name}`}
                  onClick={(e) => e.stopPropagation()}
                />

                {/* Drag Handle */}
                <div
                  data-drag-handle
                  className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
                >
                  <GripVertical className="size-5" />
                </div>

                {/* Product Image */}
                <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                  {product.image?.url ? (
                    <Image
                      src={product.image.url}
                      alt={product.image.altText || product.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <Package className="size-6 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/${storeSlug}/products/${product.id}`}
                    className="font-medium hover:underline"
                  >
                    {product.name}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{formatPrice(product.price)}</span>
                    <span>•</span>
                    {product.categories && product.categories.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {product.categories.map((cat) => (
                          <Badge
                            key={cat.id}
                            variant="secondary"
                            className="text-xs"
                          >
                            {cat.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs">Uncategorized</span>
                    )}
                  </div>
                </div>

                {/* Status Badges */}
                <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                  <div className="flex items-center gap-2">
                    {product.isActive ? (
                      <Badge>Active</Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                    {getStockBadge(product)}
                  </div>
                  {product.trackInventory && (
                    <span className="text-xs text-muted-foreground">
                      {product.stock} in stock
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 gap-1">
                  {product.trackInventory && !product.hasVariants && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setProductToAdjust(product);
                        setAdjustDialogOpen(true);
                      }}
                      title="Adjust Stock"
                    >
                      <PackagePlus className="size-4" />
                      <span className="sr-only">Adjust Stock</span>
                    </Button>
                  )}
                  <Button variant="ghost" size="icon-sm" asChild>
                    <Link
                      href={`/store/${storeSlug}/product/${product.slug}`}
                      target="_blank"
                    >
                      <Eye className="size-4" />
                      <span className="sr-only">View in Store</span>
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon-sm" asChild>
                    <Link
                      href={`/dashboard/${storeSlug}/products/${product.id}`}
                    >
                      <Pencil className="size-4" />
                      <span className="sr-only">Edit</span>
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setProductToDelete(product);
                      setDeleteDialogOpen(true);
                    }}
                    disabled={isPending}
                  >
                    <Trash2 className="size-4 text-destructive" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{productToDelete?.name}
              &quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.size} Products
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} product
              {selectedIds.size > 1 ? "s" : ""}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Adjust Stock Dialog */}
      {productToAdjust && (
        <QuickAdjustDialog
          open={adjustDialogOpen}
          onOpenChange={(open) => {
            setAdjustDialogOpen(open);
            if (!open) setProductToAdjust(null);
          }}
          tenantId={tenantId}
          productId={productToAdjust.id}
          productName={productToAdjust.name}
          currentStock={productToAdjust.stock}
        />
      )}
    </>
  );
}
