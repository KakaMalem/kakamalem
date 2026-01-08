"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  GripVertical,
  Pencil,
  Trash2,
  FolderTree,
  Package,
  Loader2,
} from "lucide-react";
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

  // Drag state (mouse)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Touch drag state
  const [touchDragIndex, setTouchDragIndex] = useState<number | null>(null);
  const [touchOverIndex, setTouchOverIndex] = useState<number | null>(null);
  const touchStartY = useRef<number>(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Save reordered categories
  const saveOrder = useCallback(
    async (newCategories: CategoryWithProductCount[]) => {
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
      const newCategories = [...categories];
      const [draggedItem] = newCategories.splice(draggedIndex, 1);
      newCategories.splice(dragOverIndex, 0, draggedItem);
      setCategories(newCategories);
      await saveOrder(newCategories);
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
      const newCategories = [...categories];
      const [draggedItem] = newCategories.splice(touchDragIndex, 1);
      newCategories.splice(touchOverIndex, 0, draggedItem);
      setCategories(newCategories);
      await saveOrder(newCategories);
    }

    setTouchDragIndex(null);
    setTouchOverIndex(null);
  };

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
      <div className="space-y-2">
        {categories.map((category, index) => {
          const isDragging = draggedIndex === index || touchDragIndex === index;
          const isDragOver =
            dragOverIndex === index || touchOverIndex === index;

          return (
            <Card
              key={category.id}
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
                {/* Drag Handle */}
                <div
                  data-drag-handle
                  className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
                >
                  <GripVertical className="size-5" />
                </div>

                {/* Category Image */}
                <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                  {category.imageUrl ? (
                    <Image
                      src={category.imageUrl}
                      alt={category.name}
                      fill
                      className="object-cover"
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
          );
        })}
      </div>

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
