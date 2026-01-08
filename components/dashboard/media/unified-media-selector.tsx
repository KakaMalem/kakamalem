"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  Search,
  Check,
  Loader2,
  ImageIcon,
  X,
  Grid3x3,
  List,
  SortAsc,
  GripVertical,
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Dropzone, type UploadedFile } from "@/components/ui/dropzone";

import {
  type MediaItem,
  getMediaLibrary,
  createMediaRecord,
} from "@/lib/actions/media";
import { formatFileSize } from "@/lib/config/file-validation";

// =============================================================================
// TYPES
// =============================================================================

export type MediaSelection = {
  id: string;
  url: string;
  altText?: string | null;
};

interface UnifiedMediaSelectorBaseProps {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Maximum number of images that can be selected (only applies to multi-select) */
  maxSelection?: number;
  /** Show the reorderable selected images section at bottom */
  showReorderSection?: boolean;
  /** Show view toggle (grid/list) */
  showViewToggle?: boolean;
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

type ViewMode = "grid" | "list";
type SortMode = "newest" | "oldest" | "name" | "size";

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
};

const checkVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 500, damping: 25 },
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
    showReorderSection = true,
    showViewToggle = true,
    className,
  } = props;

  const multiple = props.multiple ?? false;
  const initialSelectedIds = multiple
    ? props.selectedIds ?? []
    : props.selectedId
    ? [props.selectedId]
    : [];

  // State
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] =
    useState<string[]>(initialSelectedIds);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortMode, setSortMode] = useState<SortMode>("newest");

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
        toast.error("Failed to load media");
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
        });
        if (result.success && result.data) {
          newItems.push({
            id: result.data.id,
            tenantId,
            uploadedById: "",
            url: result.data.url,
            fileName: result.data.fileName,
            altText: null,
            fileSize: file.size,
            mimeType: file.mimeType,
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
        .map((m) => ({ id: m.id, url: m.url, altText: m.altText }));
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

  const handleReorder = (newOrder: string[]) => {
    setSelectedMediaIds(newOrder);
  };

  const removeFromSelection = (id: string) => {
    setSelectedMediaIds((prev) => prev.filter((i) => i !== id));
  };

  const showSelectedSection =
    multiple && showReorderSection && selectedMediaIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("max-w-4xl max-h-[90vh] flex flex-col gap-4", className)}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{title}</DialogTitle>
            {showViewToggle && (
              <div className="flex items-center gap-1 rounded-md border p-1">
                <Button
                  type="button"
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3x3 className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setViewMode("list")}
                >
                  <List className="size-4" />
                </Button>
              </div>
            )}
          </div>
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
          maxFiles={multiple ? 10 : 1}
          compact={mediaItems.length > 0}
        />

        {/* Media Grid */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading && mediaItems.length === 0 ? (
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
              {viewMode === "grid" ? (
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2"
                >
                  {mediaItems.map((item) => {
                    const isSelected = selectedMediaIds.includes(item.id);
                    const selectionIndex = selectedMediaIds.indexOf(item.id);
                    return (
                      <motion.button
                        key={item.id}
                        variants={itemVariants}
                        type="button"
                        onClick={() => handleToggleSelection(item.id)}
                        className={cn(
                          "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 group",
                          isSelected
                            ? "border-primary ring-2 ring-primary ring-offset-2"
                            : "border-transparent hover:border-muted-foreground/30"
                        )}
                      >
                        <Image
                          src={item.url}
                          alt={item.altText || item.fileName || "Image"}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 16vw"
                        />
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 bg-primary/20 flex items-center justify-center"
                            >
                              <motion.div
                                variants={checkVariants}
                                initial="hidden"
                                animate="visible"
                                exit="hidden"
                                className="bg-primary rounded-full p-1.5"
                              >
                                {multiple && selectionIndex >= 0 ? (
                                  <span className="size-5 flex items-center justify-center text-xs font-bold text-primary-foreground">
                                    {selectionIndex + 1}
                                  </span>
                                ) : (
                                  <Check className="size-5 text-primary-foreground" />
                                )}
                              </motion.div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-xs text-white truncate">
                            {item.fileName}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </motion.div>
              ) : (
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-2"
                >
                  {mediaItems.map((item) => {
                    const isSelected = selectedMediaIds.includes(item.id);
                    const selectionIndex = selectedMediaIds.indexOf(item.id);
                    return (
                      <motion.button
                        key={item.id}
                        variants={itemVariants}
                        type="button"
                        onClick={() => handleToggleSelection(item.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-2 rounded-lg border transition-all hover:bg-accent",
                          isSelected && "bg-primary/5 border-primary"
                        )}
                      >
                        <div className="relative size-16 rounded overflow-hidden shrink-0 border">
                          <Image
                            src={item.url}
                            alt={item.altText || item.fileName || "Image"}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-medium truncate">
                            {item.fileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(item.fileSize || 0)} •{" "}
                            {new Date(item.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              variants={checkVariants}
                              initial="hidden"
                              animate="visible"
                              exit="hidden"
                              className="bg-primary rounded-full p-1 shrink-0"
                            >
                              {multiple && selectionIndex >= 0 ? (
                                <span className="size-5 flex items-center justify-center text-xs font-bold text-primary-foreground">
                                  {selectionIndex + 1}
                                </span>
                              ) : (
                                <Check className="size-5 text-primary-foreground" />
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}

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

        {/* Selected Images Section */}
        <AnimatePresence>
          {showSelectedSection && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="shrink-0 border-t pt-4"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Selected ({selectedMediaIds.length})
                  {selectedMediaIds.length > 0 &&
                    " • Drag to reorder • First image is main"}
                </p>
              </div>

              <ScrollArea className="w-full">
                <Reorder.Group
                  axis="x"
                  values={selectedMediaIds}
                  onReorder={handleReorder}
                  className="flex gap-2 pb-2"
                >
                  {selectedMediaIds.map((id, index) => {
                    const item = mediaItems.find((m) => m.id === id);
                    if (!item) return null;

                    return (
                      <Reorder.Item
                        key={id}
                        value={id}
                        className={cn(
                          "relative shrink-0 size-20 rounded-lg overflow-hidden border-2 bg-muted cursor-grab active:cursor-grabbing group",
                          index === 0 && "ring-2 ring-primary"
                        )}
                      >
                        <Image
                          src={item.url}
                          alt={item.altText || item.fileName || "Image"}
                          fill
                          className="object-cover pointer-events-none"
                          sizes="80px"
                        />

                        {/* Main badge */}
                        {index === 0 && (
                          <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                            Main
                          </span>
                        )}

                        {/* Position indicator */}
                        <span className="absolute right-1 top-1 rounded-full bg-black/60 size-5 flex items-center justify-center text-[10px] font-medium text-white">
                          {index + 1}
                        </span>

                        {/* Overlay with actions */}
                        <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                          <GripVertical className="size-4 text-white" />
                        </div>

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromSelection(id);
                          }}
                          className="absolute -top-1 -right-1 rounded-full bg-destructive p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/80"
                        >
                          <X className="size-3 text-white" />
                        </button>
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>

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
