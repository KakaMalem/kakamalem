"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Trash2,
  Loader2,
  ImageIcon,
  MoreVertical,
  Pencil,
  Copy,
  Check,
  CheckSquare,
  Square,
  X,
  LayoutGrid,
  LayoutList,
  Eye,
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
import { Dropzone, type UploadedFile } from "@/components/ui/dropzone";
import { useImagePreview } from "@/components/ui/image-preview";

import {
  type MediaItem,
  updateMediaAltText,
  deleteMedia,
  getMediaLibrary,
  createMediaRecord,
} from "@/lib/actions/media";
import { MAX_FILES, formatFileSize } from "@/lib/config/file-validation";

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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.02,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 500,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.15,
      ease: "easeOut" as const,
    },
  },
};

export function MediaLibrary({
  tenantId,
  initialItems,
  initialPagination,
  initialSearch,
}: MediaLibraryProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { openPreview } = useImagePreview();
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

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  // View mode state (persisted in localStorage)
  // Use null initially to indicate "not yet loaded from localStorage"
  const [viewMode, setViewMode] = useState<"grid" | "list" | null>(null);

  // Load view mode from localStorage after mount
  useEffect(() => {
    const savedMode = localStorage.getItem("media-view-mode") as
      | "grid"
      | "list"
      | null;
    setViewMode(savedMode === "grid" ? "grid" : "list");
  }, []);

  const toggleViewMode = () => {
    const newMode = viewMode === "grid" ? "list" : "grid";
    setViewMode(newMode);
    if (typeof window !== "undefined") {
      localStorage.setItem("media-view-mode", newMode);
    }
  };

  // Toggle selection for a single item
  const toggleSelection = (itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Select all items on current page
  const selectAll = () => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  // Toggle selection mode
  const toggleSelectionMode = () => {
    if (selectionMode) {
      clearSelection();
    } else {
      setSelectionMode(true);
    }
  };

  // Bulk delete selected items
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const idsToDelete = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;

    for (const id of idsToDelete) {
      const result = await deleteMedia(tenantId, id);
      if (result.success) {
        successCount++;
        setItems((prev) => prev.filter((item) => item.id !== id));
      } else {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(
        `${successCount} image${successCount > 1 ? "s" : ""} deleted`
      );
    }
    if (failCount > 0) {
      toast.error(
        `${failCount} image${
          failCount > 1 ? "s" : ""
        } could not be deleted (may be in use)`
      );
    }

    clearSelection();
    startTransition(() => router.refresh());
  };

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

  const handleUploadComplete = async (files: UploadedFile[]) => {
    // Create media records in database for each uploaded file
    for (const file of files) {
      try {
        const result = await createMediaRecord(tenantId, {
          url: file.url,
          fileName: file.filename,
          fileSize: file.size,
          mimeType: file.mimeType,
          width: file.width,
          height: file.height,
        });

        if (result.success && result.data) {
          // Add to the beginning of the list
          setItems((prev) => [
            {
              id: result.data!.id,
              tenantId,
              uploadedById: "",
              url: result.data!.url,
              fileName: result.data!.fileName,
              altText: null,
              fileSize: file.size,
              mimeType: file.mimeType,
              width: file.width ?? null,
              height: file.height ?? null,
              createdAt: new Date().toISOString(),
            },
            ...prev,
          ]);
        }
      } catch {
        toast.error(`Failed to save ${file.originalName}`);
      }
    }
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
      {/* Search and Selection Controls */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search images..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={toggleViewMode}
          className="cursor-pointer shrink-0"
          disabled={viewMode === null}
          title={
            viewMode === "grid" ? "Switch to list view" : "Switch to grid view"
          }
        >
          {viewMode === "grid" ? (
            <LayoutList className="size-4" />
          ) : (
            <LayoutGrid className="size-4" />
          )}
        </Button>
        <Button
          variant={selectionMode ? "secondary" : "outline"}
          size="sm"
          onClick={toggleSelectionMode}
          className="cursor-pointer"
        >
          {selectionMode ? (
            <>
              <X className="size-4 mr-1" />
              Cancel
            </>
          ) : (
            <>
              <CheckSquare className="size-4 mr-1" />
              Select
            </>
          )}
        </Button>
      </div>

      {/* Selection Actions Bar */}
      {selectionMode && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
            className="cursor-pointer"
          >
            Select All
          </Button>
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selected
              </span>
              <div className="flex-1" />
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                className="cursor-pointer"
              >
                <Trash2 className="size-4 mr-1" />
                Delete Selected
              </Button>
            </>
          )}
        </div>
      )}

      {/* Upload Zone */}
      <Dropzone
        tenantId={tenantId}
        folder="media"
        onUploadComplete={handleUploadComplete}
        maxFiles={MAX_FILES.mediaLibrary}
      />

      {/* Media List */}
      {isLoading || viewMode === null ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ImageIcon className="mb-4 size-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">No images yet</h3>
            <p className="text-center text-muted-foreground">
              {search
                ? "No images match your search"
                : "Upload images to use in your products and categories"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <AnimatePresence mode="wait">
            <motion.div
              key={viewMode}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              className={
                viewMode === "grid"
                  ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
                  : "space-y-2"
              }
            >
              {items.map((item, index) => {
                const isSelected = selectedIds.has(item.id);

                // Helper to open preview at this index
                const handlePreview = () => {
                  const previewImages = items.map((m) => ({
                    src: m.url,
                    alt: m.altText || m.fileName || "Image",
                  }));
                  openPreview(previewImages, index);
                };

                // Grid view item
                if (viewMode === "grid") {
                  return (
                    <motion.div
                      key={item.id}
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className={`group relative rounded-lg border overflow-hidden ${
                        isSelected ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={
                        selectionMode
                          ? () => toggleSelection(item.id)
                          : undefined
                      }
                      style={selectionMode ? { cursor: "pointer" } : undefined}
                    >
                      {/* Image */}
                      <div className="relative aspect-square bg-muted">
                        <Image
                          src={item.url}
                          alt={item.altText || item.fileName || "Image"}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
                        />

                        {/* Selection Checkbox - overlay on image */}
                        {selectionMode && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelection(item.id);
                            }}
                            className="absolute top-2 left-2 cursor-pointer z-10"
                          >
                            {isSelected ? (
                              <CheckSquare className="size-5 text-primary bg-white rounded" />
                            ) : (
                              <Square className="size-5 text-muted-foreground bg-white/80 rounded hover:text-foreground transition-colors" />
                            )}
                          </button>
                        )}

                        {/* Preview button - bottom left */}
                        {!selectionMode && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreview();
                            }}
                            className="absolute bottom-2 left-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            title="Preview image"
                          >
                            <Eye className="size-4 text-white" />
                          </button>
                        )}

                        {/* Actions Menu - overlay on image */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="secondary"
                                size="icon-sm"
                                className="cursor-pointer size-7"
                              >
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={handlePreview}>
                                <Eye className="mr-2 size-4" />
                                Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleCopyUrl(item)}
                              >
                                {copiedId === item.id ? (
                                  <Check className="mr-2 size-4" />
                                ) : (
                                  <Copy className="mr-2 size-4" />
                                )}
                                Copy URL
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleEditOpen(item)}
                              >
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
                      </div>

                      {/* File info */}
                      <div className="p-2 bg-background">
                        <p className="text-sm font-medium truncate">
                          {item.fileName || "Untitled"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {formatFileSize(item.fileSize || 0)}
                          {item.width &&
                            item.height &&
                            ` • ${item.width}×${item.height}`}
                        </p>
                      </div>
                    </motion.div>
                  );
                }

                // List view item
                return (
                  <motion.div
                    key={item.id}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className={`group flex items-center gap-3 p-2 rounded-lg border ${
                      isSelected ? "bg-primary/10 border-primary" : "bg-muted"
                    }`}
                    onClick={
                      selectionMode ? () => toggleSelection(item.id) : undefined
                    }
                    style={selectionMode ? { cursor: "pointer" } : undefined}
                  >
                    {/* Selection Checkbox - only visible in selection mode */}
                    {selectionMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelection(item.id);
                        }}
                        className="shrink-0 cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="size-5 text-primary" />
                        ) : (
                          <Square className="size-5 text-muted-foreground hover:text-foreground transition-colors" />
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreview();
                      }}
                      className="relative size-16 rounded overflow-hidden shrink-0 border cursor-zoom-in group/thumb"
                      title="Preview image"
                    >
                      <Image
                        src={item.url}
                        alt={item.altText || item.fileName || "Image"}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/thumb:bg-black/30 transition-colors">
                        <Eye className="size-5 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity" />
                      </div>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {item.fileName || "Untitled"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(item.fileSize || 0)}
                        {item.width &&
                          item.height &&
                          ` • ${item.width}×${item.height}`}
                        {item.altText && ` • ${item.altText}`}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="cursor-pointer"
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handlePreview}>
                          <Eye className="mr-2 size-4" />
                          Preview
                        </DropdownMenuItem>
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
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>

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
