"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Reorder } from "framer-motion";
import { Pencil, Trash2, FolderTree, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

import type { CategoryWithProductCount } from "@/lib/db/queries/categories";
import { deleteCategory, reorderCategories } from "@/lib/actions/categories";

interface CategoriesListProps {
  tenantId: string;
  storeSlug: string;
  categories: CategoryWithProductCount[];
}

export function CategoriesList({
  tenantId,
  storeSlug,
  categories: initialCategories,
}: CategoriesListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState(initialCategories);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] =
    useState<CategoryWithProductCount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Handle reorder from framer-motion
  const handleReorder = useCallback(
    async (newCategories: CategoryWithProductCount[]) => {
      setCategories(newCategories);

      const result = await reorderCategories(tenantId, {
        categoryIds: newCategories.map((c) => c.id),
      });

      if (result.success) {
        toast.success("Categories reordered");
        startTransition(() => router.refresh());
      } else {
        setCategories(initialCategories);
        toast.error(result.error?.message || "Failed to reorder");
      }
    },
    [tenantId, initialCategories, router]
  );

  const handleDelete = async () => {
    if (!categoryToDelete) return;

    setIsDeleting(true);

    const result = await deleteCategory(tenantId, categoryToDelete.id);

    if (result.success) {
      toast.success("Category deleted");
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
      // Optimistic update - remove from list immediately
      setCategories((prev) => prev.filter((c) => c.id !== categoryToDelete.id));
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to delete category");
    }

    setIsDeleting(false);
  };

  if (categories.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FolderTree className="mb-4 size-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-medium">No categories yet</h3>
          <p className="mb-4 text-center text-muted-foreground">
            Create categories to organize your products and help customers find
            what they&apos;re looking for.
          </p>
          <Button asChild>
            <Link href={`/dashboard/${storeSlug}/categories/new`}>
              Create your first category
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Reorder.Group
        axis="y"
        values={categories}
        onReorder={handleReorder}
        className="space-y-2"
      >
        {categories.map((category) => (
          <Reorder.Item
            key={category.id}
            value={category}
            className="cursor-grab active:cursor-grabbing select-none"
            style={{ position: "relative" }}
            whileDrag={{ zIndex: 50 }}
          >
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                {/* Category Image */}
                <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                  {category.imageUrl ? (
                    <Image
                      src={category.imageUrl}
                      alt={category.name}
                      fill
                      className="object-cover pointer-events-none"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <FolderTree className="size-6 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Category Info */}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/${storeSlug}/categories/${category.id}`}
                    className="font-medium hover:underline"
                  >
                    {category.name}
                  </Link>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="truncate">/{category.slug}</span>
                    <span>•</span>
                    <span className="flex shrink-0 items-center gap-1">
                      <Package className="size-3" />
                      {category.productCount} product
                      {category.productCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" asChild>
                    <Link
                      href={`/dashboard/${storeSlug}/categories/${category.id}`}
                    >
                      <Pencil className="size-4" />
                      <span className="sr-only">Edit</span>
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="cursor-pointer"
                    onClick={() => {
                      setCategoryToDelete(category);
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
          </Reorder.Item>
        ))}
      </Reorder.Group>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{categoryToDelete?.name}
              &quot;?
              {categoryToDelete && categoryToDelete.productCount > 0 && (
                <>
                  {" "}
                  This category has {categoryToDelete.productCount} product
                  {categoryToDelete.productCount !== 1 ? "s" : ""}. They will
                  become uncategorized.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
