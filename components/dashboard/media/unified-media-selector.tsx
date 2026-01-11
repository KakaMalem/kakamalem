"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Check,
  Loader2,
  ImageIcon,
  SortAsc,
  X,
  LayoutGrid,
  LayoutList,
  Eye,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Dropzone, type UploadedFile } from "@/components/ui/dropzone";
import { useImagePreview } from "@/components/ui/image-preview";

import {
  type MediaItem,
  getMediaLibrary,
  createMediaRecord,
} from "@/lib/actions/media";
import {
  formatFileSize,
  MAX_FILES,
  UPLOAD_ERROR_MESSAGES,
} from "@/lib/config/file-validation";

// =============================================================================
// TYPES
// =============================================================================

export type MediaSelection = {
  id: string;
  url: string;
  altText?: string | null;
  fileSize?: number | null;
  fileName?: string | null;
  width?: number | null;
  height?: number | null;
};

interface UnifiedMediaSelectorBaseProps {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Maximum number of images that can be selected (only applies to multi-select) */
  maxSelection?: number;
  className?: string;
}

interface SingleSelectProps extends UnifiedMediaSelectorBaseProps {
  multiple?: false;
  onSelect: (media: MediaSelection | null) => void;
  selectedId?: string | null;
  selectedIds?: never;
}

interface MultiSelectProps extends UnifiedMediaSelectorBaseProps {
  multiple: true;
  onSelect: (media: MediaSelection[]) => void;
  selectedIds?: string[];
  selectedId?: never;
}

export type UnifiedMediaSelectorProps = SingleSelectProps | MultiSelectProps;

type SortMode = "newest" | "oldest" | "name" | "size";

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.015,
      delayChildren: 0.03,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 500,
      damping: 30,
    },
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function UnifiedMediaSelector(props: UnifiedMediaSelectorProps) {
  const {
    tenantId,
    open,
    onOpenChange,
    title = "Select Image",
    maxSelection,
    className,
  } = props;

  const multiple = props.multiple ?? false;
  const initialSelectedIds = multiple
    ? (props.selectedIds ?? [])
    : props.selectedId
      ? [props.selectedId]
      : [];

  // Image preview hook
  const { openPreview } = useImagePreview();

  // State
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] =
    useState<string[]>(initialSelectedIds);
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  // View mode state (persisted in localStorage)
  // Use null initially to indicate "not yet loaded from localStorage"
  const [viewMode, setViewMode] = useState<"grid" | "list" | null>(null);

  // Load view mode from localStorage after mount
  useEffect(() => {
    const savedMode = localStorage.getItem("media-selector-view-mode") as
      | "grid"
      | "list"
      | null;
    setViewMode(savedMode === "grid" ? "grid" : "list");
  }, []);

  const toggleViewMode = () => {
    const newMode = viewMode === "grid" ? "list" : "grid";
    setViewMode(newMode);
    localStorage.setItem("media-selector-view-mode", newMode);
  };

  // Load media from server
  const loadMedia = useCallback(
    async (pageNum: number, searchTerm: string, append = false) => {
      setIsLoading(true);
      try {
        const result = await getMediaLibrary(tenantId, {
          search: searchTerm || undefined,
          page: pageNum,
          limit: 24,
        });

        let items = result.items;

        // Apply client-side sorting
        if (sortMode === "oldest") {
          items = [...items].reverse();
        } else if (sortMode === "name") {
          items = [...items].sort((a, b) =>
            (a.fileName || "").localeCompare(b.fileName || "")
          );
        } else if (sortMode === "size") {
          items = [...items].sort(
            (a, b) => (b.fileSize || 0) - (a.fileSize || 0)
          );
        }

        if (append) {
          setMediaItems((prev) => [...prev, ...items]);
        } else {
          setMediaItems(items);
        }
        setHasMore(result.pagination.hasNextPage);
      } catch {
        toast.error(UPLOAD_ERROR_MESSAGES.networkError);
      } finally {
        setIsLoading(false);
      }
    },
    [tenantId, sortMode]
  );

  // Load on open
  useEffect(() => {
    if (open) {
      setPage(1);
      setSelectedMediaIds(initialSelectedIds);
      loadMedia(1, search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loadMedia, search, sortMode]);

  // Handlers
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
    loadMedia(1, value);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadMedia(nextPage, search, true);
  };

  const handleUploadComplete = async (files: UploadedFile[]) => {
    // Create media records in database
    const newItems: MediaItem[] = [];
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
          newItems.push({
            id: result.data.id,
            tenantId,
            uploadedById: "",
            // Use file.url as fallback in case result.data.url is undefined
            url: result.data.url || file.url,
            fileName: result.data.fileName || file.filename,
            altText: null,
            fileSize: file.size,
            mimeType: file.mimeType,
            width: file.width ?? null,
            height: file.height ?? null,
            createdAt: new Date().toISOString(),
          });
        }
      } catch {
        toast.error(`Failed to save ${file.originalName}`);
      }
    }

    if (newItems.length > 0) {
      // Add new media to the beginning of the list
      setMediaItems((prev) => [...newItems, ...prev]);

      // Auto-select the newly uploaded images
      if (multiple) {
        setSelectedMediaIds((prev) => {
          const newSelection = [...prev, ...newItems.map((item) => item.id)];
          // Respect maxSelection
          if (maxSelection && newSelection.length > maxSelection) {
            return newSelection.slice(0, maxSelection);
          }
          return newSelection;
        });
      } else {
        setSelectedMediaIds([newItems[0].id]);
      }
    }
  };

  const handleSelect = () => {
    if (multiple) {
      const selectedMedia = selectedMediaIds
        .map((id) => mediaItems.find((m) => m.id === id))
        .filter((m): m is MediaItem => m !== undefined)
        .map((m) => ({
          id: m.id,
          url: m.url,
          altText: m.altText,
          fileSize: m.fileSize,
          fileName: m.fileName,
          width: m.width,
          height: m.height,
        }));
      (props.onSelect as (media: MediaSelection[]) => void)(selectedMedia);
    } else {
      if (selectedMediaIds.length === 0) {
        (props.onSelect as (media: MediaSelection | null) => void)(null);
      } else {
        const media = mediaItems.find((m) => m.id === selectedMediaIds[0]);
        if (media) {
          (props.onSelect as (media: MediaSelection | null) => void)({
            id: media.id,
            url: media.url,
            altText: media.altText,
            fileSize: media.fileSize,
            fileName: media.fileName,
            width: media.width,
            height: media.height,
          });
        }
      }
    }
    onOpenChange(false);
  };

  const handleClearSelection = () => {
    setSelectedMediaIds([]);
  };

  const handleToggleSelection = (itemId: string) => {
    if (multiple) {
      setSelectedMediaIds((prev) => {
        if (prev.includes(itemId)) {
          return prev.filter((id) => id !== itemId);
        } else {
          if (maxSelection && prev.length >= maxSelection) {
            toast.error(`Maximum ${maxSelection} images allowed`);
            return prev;
          }
          return [...prev, itemId];
        }
      });
    } else {
      setSelectedMediaIds((prev) => (prev.includes(itemId) ? [] : [itemId]));
    }
  };

  // Handle dialog close - prevent closing if image preview is open
  const handleOpenChange = (newOpen: boolean) => {
    // If trying to close, check if LightGallery is open
    if (!newOpen && document.body.classList.contains("lightgallery-open")) {
      return; // Don't close the dialog while image preview is open
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn("max-w-4xl max-h-[90vh] flex flex-col gap-4", className)}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search images..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* View Mode Toggle */}
          <Button
            variant="outline"
            size="icon"
            onClick={toggleViewMode}
            className="cursor-pointer shrink-0"
            disabled={viewMode === null}
            title={
              viewMode === "grid"
                ? "Switch to list view"
                : "Switch to grid view"
            }
          >
            {viewMode === "grid" ? (
              <LayoutList className="size-4" />
            ) : (
              <LayoutGrid className="size-4" />
            )}
          </Button>

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <SortAsc className="mr-2 size-4" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSortMode("newest")}>
                <Check
                  className={cn(
                    "mr-2 size-4",
                    sortMode === "newest" ? "opacity-100" : "opacity-0"
                  )}
                />
                Newest first
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortMode("oldest")}>
                <Check
                  className={cn(
                    "mr-2 size-4",
                    sortMode === "oldest" ? "opacity-100" : "opacity-0"
                  )}
                />
                Oldest first
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortMode("name")}>
                <Check
                  className={cn(
                    "mr-2 size-4",
                    sortMode === "name" ? "opacity-100" : "opacity-0"
                  )}
                />
                Name
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortMode("size")}>
                <Check
                  className={cn(
                    "mr-2 size-4",
                    sortMode === "size" ? "opacity-100" : "opacity-0"
                  )}
                />
                File size
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Upload Zone */}
        <Dropzone
          tenantId={tenantId}
          folder="media"
          onUploadComplete={handleUploadComplete}
          maxFiles={multiple ? MAX_FILES.mediaSelector : 1}
        />

        {/* Media Grid/List */}
        <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
          {(isLoading && mediaItems.length === 0) || viewMode === null ? (
            <div className="flex items-center justify-center h-full min-h-64">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : mediaItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-64 text-center">
              <ImageIcon className="size-16 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">
                {search
                  ? "No images match your search"
                  : "No images uploaded yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Upload your first image to get started
              </p>
            </div>
          ) : (
            <>
              <AnimatePresence mode="wait">
                <motion.div
                  key={viewMode}
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  className={
                    viewMode === "grid"
                      ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 p-0.5"
                      : "space-y-2 p-0.5"
                  }
                >
                  {mediaItems.map((item, index) => {
                    const isSelected = selectedMediaIds.includes(item.id);

                    // Helper to open preview at this index
                    const handlePreview = () => {
                      const previewImages = mediaItems
                        .filter((m) => m.url)
                        .map((m) => ({
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
                          className={cn(
                            "group relative aspect-square rounded-lg border overflow-hidden transition-all",
                            isSelected && "ring-2 ring-primary"
                          )}
                        >
                          {/* Image as preview button */}
                          <button
                            type="button"
                            onClick={handlePreview}
                            className="absolute inset-0 w-full h-full cursor-zoom-in"
                            title="Preview image"
                          >
                            {item.url ? (
                              <Image
                                src={item.url}
                                alt={item.altText || item.fileName || "Image"}
                                fill
                                className="object-cover"
                                sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"
                                unoptimized
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                                <ImageIcon className="size-8 text-muted-foreground" />
                              </div>
                            )}
                            {/* Eye icon overlay on hover */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                              <Eye className="size-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </button>

                          {/* Selection checkbox */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSelection(item.id);
                            }}
                            className={cn(
                              "absolute top-1 right-1 p-0.5 rounded-full transition-all z-10",
                              isSelected
                                ? "bg-primary"
                                : "bg-white/80 hover:bg-white border border-gray-300"
                            )}
                            title={isSelected ? "Deselect" : "Select"}
                          >
                            <Check
                              className={cn(
                                "size-4 transition-colors",
                                isSelected
                                  ? "text-primary-foreground"
                                  : "text-gray-400"
                              )}
                            />
                          </button>
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
                        className={cn(
                          "group w-full flex items-center gap-3 p-2 rounded-lg border transition-all hover:bg-accent",
                          isSelected && "bg-primary/5 border-primary"
                        )}
                      >
                        {/* Image thumbnail as preview button */}
                        <button
                          type="button"
                          onClick={handlePreview}
                          className="relative size-16 rounded overflow-hidden shrink-0 border cursor-zoom-in group/thumb"
                          title="Preview image"
                        >
                          {item.url ? (
                            <Image
                              src={item.url}
                              alt={item.altText || item.fileName || "Image"}
                              fill
                              className="object-cover"
                              sizes="64px"
                              unoptimized
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-muted">
                              <ImageIcon className="size-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/thumb:bg-black/30 transition-colors">
                            <Eye className="size-5 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity" />
                          </div>
                        </button>

                        {/* Info section - clicking selects */}
                        <button
                          type="button"
                          onClick={() => handleToggleSelection(item.id)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <p className="font-medium truncate">
                            {item.fileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(item.fileSize || 0)}
                            {item.width &&
                              item.height &&
                              ` • ${item.width}×${item.height}`}
                            {" • "}
                            {new Date(item.createdAt).toLocaleDateString()}
                          </p>
                        </button>

                        {/* Selection checkbox */}
                        <button
                          type="button"
                          onClick={() => handleToggleSelection(item.id)}
                          className={cn(
                            "p-0.5 rounded-full transition-all shrink-0",
                            isSelected
                              ? "bg-primary"
                              : "bg-muted hover:bg-muted/80 border border-gray-300"
                          )}
                          title={isSelected ? "Deselect" : "Select"}
                        >
                          <Check
                            className={cn(
                              "size-5 transition-colors",
                              isSelected
                                ? "text-primary-foreground"
                                : "text-gray-400"
                            )}
                          />
                        </button>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>

              {hasMore && (
                <div className="flex justify-center mt-6 pb-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load More"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="shrink-0 gap-2 sm:gap-2">
          {selectedMediaIds.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleClearSelection}
              className="mr-auto"
            >
              <X className="mr-2 size-4" />
              Clear
              {multiple && selectedMediaIds.length > 1
                ? ` (${selectedMediaIds.length})`
                : ""}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSelect}>
            {selectedMediaIds.length > 0
              ? multiple
                ? `Select ${selectedMediaIds.length} Image${
                    selectedMediaIds.length > 1 ? "s" : ""
                  }`
                : "Select Image"
              : "No Image"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
