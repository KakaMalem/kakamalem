"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Reorder, useDragControls } from "framer-motion";
import {
  Pencil,
  Trash2,
  Package,
  Eye,
  PackagePlus,
  Check,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { deleteProduct, reorderProducts } from "@/lib/actions/products";
import { QuickAdjustDialog } from "@/components/dashboard/inventory/quick-adjust-dialog";
import { cn } from "@/lib/utils";

interface ProductsListProps {
  tenantId: string;
  storeSlug: string;
  currency: string;
  products: ProductWithCategory[];
  // Selection props from parent
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  selectionMode: boolean;
}

// Draggable product item component with drag handle
function DraggableProductItem({
  product,
  storeSlug,
  currency,
  selectionMode,
  isSelected,
  onToggleSelection,
  onDelete,
  onAdjustStock,
  getStockBadge,
  isPending,
}: {
  product: ProductWithCategory;
  storeSlug: string;
  currency: string;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: () => void;
  onDelete: () => void;
  onAdjustStock: () => void;
  getStockBadge: (product: ProductWithCategory) => React.ReactNode;
  isPending: boolean;
}) {
  const dragControls = useDragControls();

  const formatPrice = (price: string) => {
    return `${parseFloat(price).toLocaleString()} ${currency}`;
  };

  return (
    <Reorder.Item
      value={product}
      dragListener={false}
      dragControls={dragControls}
      className="select-none"
      style={{ position: "relative" }}
      whileDrag={{ zIndex: 50 }}
    >
      <Card>
        <CardContent className="flex items-center gap-4 px-2 md:px-4">
          {/* Drag Handle or Select Checkbox - toggle based on selection mode */}
          {selectionMode ? (
            <button
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              data-checked={isSelected}
              onClick={onToggleSelection}
              className="group relative flex shrink-0 items-center justify-center outline-none cursor-pointer"
            >
              {/* Outer ring */}
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 flex items-center justify-center rounded-full border bg-background transition-all duration-150",
                  isSelected
                    ? "border-foreground"
                    : "border-muted-foreground/40 group-hover:border-muted-foreground/60"
                )}
              >
                {/* Checkmark container */}
                <div
                  className={cn(
                    "rounded-full bg-foreground p-0.5 transition-all duration-100",
                    isSelected ? "scale-100 opacity-100" : "scale-90 opacity-0"
                  )}
                >
                  <Check className="size-3 text-background" strokeWidth={3} />
                </div>
              </div>
              {/* Placeholder for consistent sizing */}
              <div className="size-5" />
            </button>
          ) : (
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="cursor-grab active:cursor-grabbing shrink-0 touch-none p-1 -m-1"
            >
              <GripVertical className="size-5 text-muted-foreground" />
            </div>
          )}

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
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/${storeSlug}/products/${product.id}`}
                className="truncate font-medium hover:underline"
              >
                {product.name}
              </Link>
              {/* Mobile stock badge */}
              <div className="sm:hidden">{getStockBadge(product)}</div>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>{formatPrice(product.price)}</span>
              {product.trackInventory && (
                <span className="sm:hidden">• {product.stock} in stock</span>
              )}
              {product.categories && product.categories.length > 0 && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <div className="hidden flex-wrap gap-1 sm:flex">
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
                </>
              )}
            </div>
          </div>

          {/* Status Badges */}
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            {getStockBadge(product)}
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
                onClick={onAdjustStock}
                title="Adjust Stock"
              >
                <PackagePlus className="size-4" />
                <span className="sr-only">Adjust Stock</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                // Open in external browser for PWA compatibility
                const url = `${window.location.origin}/store/${storeSlug}/product/${product.slug}`;
                window.open(url, "_blank", "");
              }}
            >
              <Eye className="size-4" />
              <span className="sr-only">View in Store</span>
            </Button>
            <Button variant="ghost" size="icon-sm" asChild>
              <Link href={`/dashboard/${storeSlug}/products/${product.id}`}>
                <Pencil className="size-4" />
                <span className="sr-only">Edit</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer"
              onClick={onDelete}
              disabled={isPending}
            >
              <Trash2 className="size-4 text-destructive" />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </Reorder.Item>
  );
}

export function ProductsList({
  tenantId,
  storeSlug,
  currency,
  products: initialProducts,
  selectedIds,
  onSelectionChange,
  selectionMode,
}: ProductsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [products, setProducts] = useState(initialProducts);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] =
    useState<ProductWithCategory | null>(null);

  // Quick adjust dialog state
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [productToAdjust, setProductToAdjust] =
    useState<ProductWithCategory | null>(null);

  // Sync products when initialProducts change
  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  // Handle reorder from framer-motion
  const handleReorder = useCallback(
    async (newProducts: ProductWithCategory[]) => {
      setProducts(newProducts);

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
    const next = new Set(selectedIds);
    if (next.has(productId)) {
      next.delete(productId);
    } else {
      next.add(productId);
    }
    onSelectionChange(next);
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
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 px-4">
        <div className="mb-4 rounded-full bg-muted p-4">
          <Package className="size-8 text-muted-foreground" />
        </div>
        <h3 className="mb-1 text-lg font-semibold">No products yet</h3>
        <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
          Add your first product to start selling in your store.
        </p>
        <Button asChild>
          <Link href={`/dashboard/${storeSlug}/products/new`}>
            <Package className="size-4" />
            Add your first product
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <Reorder.Group
        axis="y"
        values={products}
        onReorder={handleReorder}
        className="space-y-2"
      >
        {products.map((product) => (
          <DraggableProductItem
            key={product.id}
            product={product}
            storeSlug={storeSlug}
            currency={currency}
            selectionMode={selectionMode}
            isSelected={selectedIds.has(product.id)}
            onToggleSelection={() => toggleSelection(product.id)}
            onDelete={() => {
              setProductToDelete(product);
              setDeleteDialogOpen(true);
            }}
            onAdjustStock={() => {
              setProductToAdjust(product);
              setAdjustDialogOpen(true);
            }}
            getStockBadge={getStockBadge}
            isPending={isPending}
          />
        ))}
      </Reorder.Group>

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
