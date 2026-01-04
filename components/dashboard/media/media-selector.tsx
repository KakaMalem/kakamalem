"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Upload, Search, Check, Loader2, ImageIcon, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import {
  type MediaItem,
  getMediaLibrary,
  uploadMedia,
} from "@/lib/supabase/media";

type MediaSelection = { id: string; url: string };

interface MediaSelectorBaseProps {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
}

interface SingleSelectProps extends MediaSelectorBaseProps {
  multiple?: false;
  onSelect: (media: MediaSelection | null) => void;
  selectedId?: string | null;
  selectedIds?: never;
}

interface MultiSelectProps extends MediaSelectorBaseProps {
  multiple: true;
  onSelect: (media: MediaSelection[]) => void;
  selectedIds?: string[];
  selectedId?: never;
}

type MediaSelectorProps = SingleSelectProps | MultiSelectProps;

export function MediaSelector(props: MediaSelectorProps) {
  const {
    tenantId,
    open,
    onOpenChange,
    onSelect,
    title = "Select Image",
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] =
    useState<string[]>(initialSelectedIds);

  const loadMedia = useCallback(
    async (pageNum: number, searchTerm: string, append = false) => {
      setIsLoading(true);
      try {
        const result = await getMediaLibrary(tenantId, {
          search: searchTerm || undefined,
          page: pageNum,
          limit: 24,
        });

        if (append) {
          setMediaItems((prev) => [...prev, ...result.items]);
        } else {
          setMediaItems(result.items);
        }
        setHasMore(result.pagination.hasNextPage);
      } catch {
        toast.error("Failed to load media");
      } finally {
        setIsLoading(false);
      }
    },
    [tenantId]
  );

  useEffect(() => {
    if (open) {
      setPage(1);
      setSelectedMediaIds(initialSelectedIds);
      loadMedia(1, search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loadMedia, search]);

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

    const uploadedIds: string[] = [];
    const newItems: MediaItem[] = [];

    for (const file of validFiles) {
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
        setSelectedMediaIds((prev) => [...prev, ...uploadedIds]);
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
    e.target.value = "";
  };

  const handleSelect = () => {
    if (multiple) {
      const selectedMedia = selectedMediaIds
        .map((id) => mediaItems.find((m) => m.id === id))
        .filter((m): m is MediaItem => m !== undefined)
        .map((m) => ({ id: m.id, url: m.url }));
      (onSelect as (media: MediaSelection[]) => void)(selectedMedia);
    } else {
      if (selectedMediaIds.length === 0) {
        (onSelect as (media: MediaSelection | null) => void)(null);
      } else {
        const media = mediaItems.find((m) => m.id === selectedMediaIds[0]);
        if (media) {
          (onSelect as (media: MediaSelection | null) => void)({
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
      setSelectedMediaIds((prev) =>
        prev.includes(itemId)
          ? prev.filter((id) => id !== itemId)
          : [...prev, itemId]
      );
    } else {
      setSelectedMediaIds((prev) => (prev.includes(itemId) ? [] : [itemId]));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Search and Upload */}
        <div className="flex gap-2">
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
            <Button
              type="button"
              variant="outline"
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
        </div>

        {/* Media Grid */}
        <div className="flex-1 overflow-y-auto min-h-75">
          {isLoading && mediaItems.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-70">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : mediaItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-70 text-center">
              <ImageIcon className="size-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
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
                        "relative aspect-square rounded-lg overflow-hidden border-2 transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
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
                          <div className="bg-primary rounded-full p-1">
                            {multiple && selectionIndex >= 0 ? (
                              <span className="size-4 flex items-center justify-center text-xs font-bold text-primary-foreground">
                                {selectionIndex + 1}
                              </span>
                            ) : (
                              <Check className="size-4 text-primary-foreground" />
                            )}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-4">
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
        <DialogFooter className="shrink-0 gap-2">
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
