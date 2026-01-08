"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Copy,
  ToggleLeft,
  ToggleRight,
  ChevronLeft,
  ChevronRight,
  Package,
} from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  bulkActivateProducts,
  bulkDeactivateProducts,
  bulkDeleteProducts,
} from "@/lib/actions/products";

interface ProductsTableProps {
  products: ProductWithCategory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  storeSlug: string;
  currency: string;
  tenantId: string;
}

export function ProductsTable({
  products,
  pagination,
  storeSlug,
  currency,
  tenantId,
}: ProductsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const allSelected =
    products.length > 0 && selectedIds.size === products.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDelete = async (productId: string) => {
    const result = await deleteProduct(tenantId, productId);
    if (result.success) {
      toast.success("Product deleted successfully");
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to delete product");
    }
    setDeleteDialogOpen(false);
    setProductToDelete(null);
  };

  const handleBulkAction = async (
    action: "activate" | "deactivate" | "delete"
  ) => {
    const ids = Array.from(selectedIds);

    if (action === "delete") {
      setBulkDeleteDialogOpen(true);
      return;
    }

    let result;
    if (action === "activate") {
      result = await bulkActivateProducts(tenantId, ids);
    } else {
      result = await bulkDeactivateProducts(tenantId, ids);
    }

    if (result.success) {
      toast.success(
        `${ids.length} product(s) ${
          action === "activate" ? "activated" : "deactivated"
        }`
      );
      setSelectedIds(new Set());
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || `Failed to ${action} products`);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const result = await bulkDeleteProducts(tenantId, ids);

    if (result.success) {
      toast.success(`${ids.length} product(s) deleted`);
      setSelectedIds(new Set());
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to delete products");
    }
    setBulkDeleteDialogOpen(false);
  };

  const getStockBadge = (product: ProductWithCategory) => {
    // Don't show stock status for products without inventory tracking
    if (!product.trackInventory) {
      return (
        <Badge variant="secondary" className="text-muted-foreground">
          Not Tracked
        </Badge>
      );
    }
    if (product.stock === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
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
    return (
      <Badge variant="outline" className="border-green-500 text-green-600">
        In Stock
      </Badge>
    );
  };

  const formatPrice = (price: string) => {
    return `${parseFloat(price).toLocaleString()} ${currency}`;
  };

  return (
    <>
      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkAction("activate")}
            disabled={isPending}
          >
            <ToggleRight className="mr-1 size-4" />
            Activate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkAction("deactivate")}
            disabled={isPending}
          >
            <ToggleLeft className="mr-1 size-4" />
            Deactivate
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleBulkAction("delete")}
            disabled={isPending}
          >
            <Trash2 className="mr-1 size-4" />
            Delete
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) {
                      (
                        el as HTMLButtonElement & { indeterminate?: boolean }
                      ).indeterminate = someSelected;
                    }
                  }}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="size-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No products found</p>
                    <Button asChild size="sm">
                      <Link href={`/dashboard/${storeSlug}/products/new`}>
                        Add your first product
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(product.id)}
                      onCheckedChange={() => toggleSelect(product.id)}
                      aria-label={`Select ${product.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/${storeSlug}/products/${product.id}`}
                      className="flex items-center gap-3 hover:underline"
                    >
                      <div className="relative size-10 overflow-hidden rounded-md bg-muted">
                        {product.image?.url ? (
                          <Image
                            src={product.image.url}
                            alt={product.image.altText || product.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center">
                            <Package className="size-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.slug}
                        </p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    {product.categoryName ? (
                      <Badge variant="secondary">{product.categoryName}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{formatPrice(product.price)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>{product.stock}</span>
                      {getStockBadge(product)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {product.status === "active" ? (
                      <Badge>Active</Badge>
                    ) : product.status === "archived" ? (
                      <Badge variant="outline">Archived</Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/${storeSlug}/products/${product.id}`}
                          >
                            <Pencil className="mr-2 size-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/store/${storeSlug}/product/${product.slug}`}
                            target="_blank"
                          >
                            <Eye className="mr-2 size-4" />
                            View in Store
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            navigator.clipboard.writeText(product.slug);
                            toast.success("Slug copied to clipboard");
                          }}
                        >
                          <Copy className="mr-2 size-4" />
                          Copy Slug
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            setProductToDelete(product.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} products
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1 || isPending}
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                params.set("page", String(pagination.page - 1));
                startTransition(() =>
                  router.push(
                    `/dashboard/${storeSlug}/products?${params.toString()}`
                  )
                );
              }}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.totalPages || isPending}
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                params.set("page", String(pagination.page + 1));
                startTransition(() =>
                  router.push(
                    `/dashboard/${storeSlug}/products?${params.toString()}`
                  )
                );
              }}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this product? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => productToDelete && handleDelete(productToDelete)}
            >
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
              Are you sure you want to delete these products? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleBulkDelete}>
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
