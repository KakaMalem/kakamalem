"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  Upload,
  Search,
  Trash2,
  Loader2,
  ImageIcon,
  MoreVertical,
  Pencil,
  Copy,
  Check,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";

import {
  type MediaItem,
  uploadMedia,
  updateMediaAltText,
  deleteMedia,
  getMediaLibrary,
} from "@/lib/supabase/media";

interface MediaLibraryProps {
  tenantId: string;
  initialItems: MediaItem[];
  initialPagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  initialSearch: string;
}

export function MediaLibrary({
  tenantId,
  initialItems,
  initialPagination,
  initialSearch,
}: MediaLibraryProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [items, setItems] = useState(initialItems);
  const [pagination, setPagination] = useState(initialPagination);
  const [search, setSearch] = useState(initialSearch);
  const [isLoading, setIsLoading] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [editAltText, setEditAltText] = useState("");

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<MediaItem | null>(null);

  // Copied URL state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadMedia = async (pageNum: number, searchTerm: string) => {
    setIsLoading(true);
    try {
      const result = await getMediaLibrary(tenantId, {
        search: searchTerm || undefined,
        page: pageNum,
        limit: 24,
      });
      setItems(result.items);
      setPagination(result.pagination);
    } catch {
      toast.error("Failed to load media");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    // Debounce search
    const timeout = setTimeout(() => {
      loadMedia(1, value);
    }, 300);
    return () => clearTimeout(timeout);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image`);
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 5MB)`);
        continue;
      }

      const result = await uploadMedia(tenantId, file);

      if (result.success && result.data) {
        toast.success(`${file.name} uploaded`);
        // Refresh the list
        loadMedia(1, search);
      } else {
        toast.error(result.error?.message || `Failed to upload ${file.name}`);
      }
    }

    setIsUploading(false);
    e.target.value = "";
  };

  const handleEditOpen = (item: MediaItem) => {
    setEditingItem(item);
    setEditAltText(item.altText || "");
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingItem) return;

    const result = await updateMediaAltText(
      tenantId,
      editingItem.id,
      editAltText
    );

    if (result.success) {
      toast.success("Alt text updated");
      setItems((prev) =>
        prev.map((item) =>
          item.id === editingItem.id ? { ...item, altText: editAltText } : item
        )
      );
      setEditDialogOpen(false);
    } else {
      toast.error(result.error?.message || "Failed to update alt text");
    }
  };

  const handleDeleteOpen = (item: MediaItem) => {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingItem) return;

    const result = await deleteMedia(tenantId, deletingItem.id);

    if (result.success) {
      toast.success("Image deleted");
      setItems((prev) => prev.filter((item) => item.id !== deletingItem.id));
      setDeleteDialogOpen(false);
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to delete image");
    }
  };

  const handleCopyUrl = async (item: MediaItem) => {
    await navigator.clipboard.writeText(item.url);
    setCopiedId(item.id);
    toast.success("URL copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePageChange = (newPage: number) => {
    loadMedia(newPage, search);
  };

  return (
    <div className="space-y-6">
      {/* Search and Upload */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search images..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            disabled={isUploading}
            className="sr-only"
          />
          <Button disabled={isUploading} asChild>
            <span className="cursor-pointer">
              {isUploading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Upload className="mr-2 size-4" />
              )}
              Upload Images
            </span>
          </Button>
        </label>
      </div>

      {/* Media Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ImageIcon className="mb-4 size-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">No images yet</h3>
            <p className="mb-4 text-center text-muted-foreground">
              {search
                ? "No images match your search"
                : "Upload images to use in your products and categories"}
            </p>
            {!search && (
              <label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleUpload}
                  disabled={isUploading}
                  className="sr-only"
                />
                <Button disabled={isUploading} asChild>
                  <span className="cursor-pointer">
                    <Upload className="mr-2 size-4" />
                    Upload your first image
                  </span>
                </Button>
              </label>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((item) => (
              <div
                key={item.id}
                className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
              >
                <Image
                  src={item.url}
                  alt={item.altText || item.fileName || "Image"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                />

                {/* Overlay with actions */}
                <div className="absolute inset-0 flex items-start justify-end bg-linear-to-b from-black/50 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon-sm"
                        className="size-7"
                      >
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleCopyUrl(item)}>
                        {copiedId === item.id ? (
                          <Check className="mr-2 size-4" />
                        ) : (
                          <Copy className="mr-2 size-4" />
                        )}
                        Copy URL
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEditOpen(item)}>
                        <Pencil className="mr-2 size-4" />
                        Edit Alt Text
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteOpen(item)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* File name tooltip */}
                <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="truncate text-xs text-white">
                    {item.fileName || "Untitled"}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasPrevPage || isLoading}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasNextPage || isLoading}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Edit Alt Text Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Alt Text</DialogTitle>
            <DialogDescription>
              Alt text helps describe the image for accessibility and SEO.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editingItem && (
              <div className="relative aspect-video overflow-hidden rounded-lg border bg-muted">
                <Image
                  src={editingItem.url}
                  alt={editingItem.altText || "Preview"}
                  fill
                  className="object-contain"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="altText">Alt Text</Label>
              <Input
                id="altText"
                value={editAltText}
                onChange={(e) => setEditAltText(e.target.value)}
                placeholder="Describe the image..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Image</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this image? This action cannot be
              undone. If the image is in use by products or categories, the
              deletion will be blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deletingItem && (
            <div className="relative aspect-video overflow-hidden rounded-lg border bg-muted">
              <Image
                src={deletingItem.url}
                alt={deletingItem.altText || "Preview"}
                fill
                className="object-contain"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
