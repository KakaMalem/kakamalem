"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Upload,
  Search,
  Check,
  Loader2,
  ImageIcon,
  X,
  Grid3x3,
  List,
  SortAsc,
  GripVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import {
  type MediaItem,
  getMediaLibrary,
  uploadMedia,
} from "@/lib/supabase/media";

type MediaSelection = { id: string; url: string };

interface EnhancedMediaPickerBaseProps {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  maxSelection?: number;
  allowUpload?: boolean;
  showViewToggle?: boolean;
  /** Show a "Selected" tab for reordering images */
  showSelectedTab?: boolean;
  className?: string;
}

interface SingleSelectProps extends EnhancedMediaPickerBaseProps {
  multiple?: false;
  onSelect: (media: MediaSelection | null) => void;
  selectedId?: string | null;
  selectedIds?: never;
}

interface MultiSelectProps extends EnhancedMediaPickerBaseProps {
  multiple: true;
  onSelect: (media: MediaSelection[]) => void;
  selectedIds?: string[];
  selectedId?: never;
}

type EnhancedMediaPickerProps = SingleSelectProps | MultiSelectProps;

type ViewMode = "grid" | "list";
type SortMode = "newest" | "oldest" | "name" | "size";

export function EnhancedMediaPicker(props: EnhancedMediaPickerProps) {
  const {
    tenantId,
    open,
    onOpenChange,
    title = "Select Images",
    maxSelection,
    allowUpload = true,
    showViewToggle = true,
    showSelectedTab = true,
    className,
  } = props;

  const multiple = props.multiple ?? false;
  const initialSelectedIds = multiple
    ? props.selectedIds ?? []
    : props.selectedId
    ? [props.selectedId]
    : [];

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] =
    useState<string[]>(initialSelectedIds);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [activeTab, setActiveTab] = useState<"library" | "selected">("library");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag state for reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

        // Apply sorting
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

  useEffect(() => {
    if (open) {
      setPage(1);
      setSelectedMediaIds(initialSelectedIds);
      setActiveTab("library");
      loadMedia(1, search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loadMedia, search, sortMode]);

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Validate all files first
    const validFiles: File[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image file`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} must be less than 5MB`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: validFiles.length });

    const uploadedIds: string[] = [];
    const newItems: MediaItem[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      setUploadProgress({ current: i + 1, total: validFiles.length });

      const result = await uploadMedia(tenantId, file);

      if (result.success && result.data) {
        const newItem: MediaItem = {
          id: result.data.id,
          tenantId,
          uploadedById: "",
          url: result.data.url,
          fileName: result.data.fileName,
          altText: null,
          fileSize: file.size,
          mimeType: file.type,
          createdAt: new Date(),
        };
        newItems.push(newItem);
        uploadedIds.push(result.data.id);
      } else {
        toast.error(result.error?.message || `Failed to upload ${file.name}`);
      }
    }

    if (newItems.length > 0) {
      // Add new media to the beginning of the list
      setMediaItems((prev) => [...newItems, ...prev]);
      // Auto-select the newly uploaded images
      if (multiple) {
        setSelectedMediaIds((prev) => {
          const newSelection = [...prev, ...uploadedIds];
          // Respect maxSelection if set
          if (maxSelection && newSelection.length > maxSelection) {
            return newSelection.slice(0, maxSelection);
          }
          return newSelection;
        });
      } else {
        // For single select, only select the first uploaded image
        setSelectedMediaIds([uploadedIds[0]]);
      }
      toast.success(
        newItems.length === 1
          ? "Image uploaded"
          : `${newItems.length} images uploaded`
      );
    }

    setIsUploading(false);
    setUploadProgress(null);

    // Reset file input
    e.target.value = "";
  };

  const handleSelect = () => {
    if (multiple) {
      const selectedMedia = selectedMediaIds
        .map((id) => mediaItems.find((m) => m.id === id))
        .filter((m): m is MediaItem => m !== undefined)
        .map((m) => ({ id: m.id, url: m.url }));
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

  // Drag and drop handlers for reordering
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null) {
      const newOrder = [...selectedMediaIds];
      const [removed] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(dragOverIndex, 0, removed);
      setSelectedMediaIds(newOrder);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= selectedMediaIds.length) return;
    const newOrder = [...selectedMediaIds];
    const [removed] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, removed);
    setSelectedMediaIds(newOrder);
  };

  const removeFromSelection = (id: string) => {
    setSelectedMediaIds((prev) => prev.filter((i) => i !== id));
  };

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get selected items with their media data
  const selectedItems = selectedMediaIds
    .map((id) => mediaItems.find((m) => m.id === id))
    .filter((m): m is MediaItem => m !== undefined);

  const showTabs = multiple && showSelectedTab && selectedMediaIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("max-w-4xl max-h-[90vh] flex flex-col", className)}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{title}</DialogTitle>
            {showViewToggle && activeTab === "library" && (
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

        {showTabs ? (
          <Tabs
            value={activeTab}
            onValueChange={(v: string) =>
              setActiveTab(v as "library" | "selected")
            }
            className="flex-1 flex flex-col min-h-0"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="library">Library</TabsTrigger>
              <TabsTrigger value="selected">
                Selected ({selectedMediaIds.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="library"
              className="flex-1 flex flex-col min-h-0 mt-4"
            >
              {renderLibraryContent()}
            </TabsContent>

            <TabsContent
              value="selected"
              className="flex-1 flex flex-col min-h-0 mt-4"
            >
              {renderSelectedContent()}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {renderLibraryContent()}
          </div>
        )}

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

  function renderLibraryContent() {
    return (
      <>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative flex-1 min-w-50">
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

          {/* Upload button */}
          {allowUpload && (
            <label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleUpload}
                disabled={isUploading}
                className="sr-only"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploading}
                asChild
              >
                <span className="cursor-pointer">
                  {isUploading ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 size-4" />
                  )}
                  Upload
                </span>
              </Button>
            </label>
          )}
        </div>

        {/* Upload Progress */}
        {isUploading && uploadProgress && (
          <div className="space-y-2 shrink-0">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Uploading {uploadProgress.current} of {uploadProgress.total}...
              </span>
              <span className="font-medium">
                {Math.round(
                  (uploadProgress.current / uploadProgress.total) * 100
                )}
                %
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${
                    (uploadProgress.current / uploadProgress.total) * 100
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Media Grid/List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading && mediaItems.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-80">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : mediaItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-80 text-center">
              <ImageIcon className="size-16 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">
                {search
                  ? "No images match your search"
                  : "No images uploaded yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {allowUpload
                  ? "Upload your first image to get started"
                  : "Ask an administrator to upload images"}
              </p>
            </div>
          ) : (
            <>
              {viewMode === "grid" ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {mediaItems.map((item) => {
                    const isSelected = selectedMediaIds.includes(item.id);
                    const selectionIndex = selectedMediaIds.indexOf(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleToggleSelection(item.id)}
                        className={cn(
                          "relative aspect-square rounded-lg overflow-hidden border-2 transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 group",
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
                        {isSelected && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <div className="bg-primary rounded-full p-1.5">
                              {multiple && selectionIndex >= 0 ? (
                                <span className="size-5 flex items-center justify-center text-xs font-bold text-primary-foreground">
                                  {selectionIndex + 1}
                                </span>
                              ) : (
                                <Check className="size-5 text-primary-foreground" />
                              )}
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-xs text-white truncate">
                            {item.fileName}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {mediaItems.map((item) => {
                    const isSelected = selectedMediaIds.includes(item.id);
                    const selectionIndex = selectedMediaIds.indexOf(item.id);
                    return (
                      <button
                        key={item.id}
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
                            {formatFileSize(item.fileSize)} •{" "}
                            {new Date(item.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="bg-primary rounded-full p-1 shrink-0">
                            {multiple && selectionIndex >= 0 ? (
                              <span className="size-5 flex items-center justify-center text-xs font-bold text-primary-foreground">
                                {selectionIndex + 1}
                              </span>
                            ) : (
                              <Check className="size-5 text-primary-foreground" />
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
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
      </>
    );
  }

  function renderSelectedContent() {
    if (selectedItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-80 text-center">
          <ImageIcon className="size-16 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No images selected</p>
          <p className="text-sm text-muted-foreground mt-1">
            Go to the Library tab to select images
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            Drag to reorder • First image is the main image
          </Label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {selectedItems.map((item, index) => {
            const isDragging = draggedIndex === index;
            const isDragOver = dragOverIndex === index;

            return (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "group relative aspect-square rounded-lg overflow-hidden border-2 bg-muted transition-all",
                  isDragging && "opacity-50 scale-95",
                  isDragOver && "ring-2 ring-primary ring-offset-2",
                  index === 0 && "ring-2 ring-primary"
                )}
              >
                <Image
                  src={item.url}
                  alt={item.altText || item.fileName || "Image"}
                  fill
                  className="object-cover pointer-events-none"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                />

                {/* Main badge */}
                {index === 0 && (
                  <span className="absolute left-2 top-2 rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    Main
                  </span>
                )}

                {/* Position indicator */}
                <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                  {index + 1}
                </span>

                {/* Drag handle overlay */}
                <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex flex-col items-center gap-1">
                    <GripVertical className="size-5 text-white cursor-grab active:cursor-grabbing" />
                    <span className="text-xs text-white/80">
                      Drag to reorder
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="size-7"
                    onClick={() => moveImage(index, index - 1)}
                    disabled={index === 0}
                    title="Move left"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="size-7"
                    onClick={() => moveImage(index, index + 1)}
                    disabled={index === selectedItems.length - 1}
                    title="Move right"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="size-7"
                    onClick={() => removeFromSelection(item.id)}
                    title="Remove"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
}
