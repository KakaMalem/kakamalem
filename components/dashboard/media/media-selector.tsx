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

interface MediaSelectorProps {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (media: { id: string; url: string } | null) => void;
  selectedId?: string | null;
  title?: string;
}

export function MediaSelector({
  tenantId,
  open,
  onOpenChange,
  onSelect,
  selectedId,
  title = "Select Image",
}: MediaSelectorProps) {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(
    selectedId ?? null
  );

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
      setSelectedMedia(selectedId ?? null);
      loadMedia(1, search);
    }
  }, [open, selectedId, loadMedia, search]);

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
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setIsUploading(true);

    const result = await uploadMedia(tenantId, file);

    if (result.success && result.data) {
      // Add new media to the beginning of the list
      const newItem: MediaItem = {
        id: result.data.id,
        tenantId,
        uploadedById: "", // Will be filled by server
        url: result.data.url,
        fileName: result.data.fileName,
        altText: null,
        fileSize: file.size,
        mimeType: file.type,
        createdAt: new Date(),
      };
      setMediaItems((prev) => [newItem, ...prev]);
      setSelectedMedia(result.data.id);
      toast.success("Image uploaded");
    } else {
      toast.error(result.error?.message || "Failed to upload image");
    }

    setIsUploading(false);
    e.target.value = "";
  };

  const handleSelect = () => {
    if (!selectedMedia) {
      onSelect(null);
    } else {
      const media = mediaItems.find((m) => m.id === selectedMedia);
      if (media) {
        onSelect({ id: media.id, url: media.url });
      }
    }
    onOpenChange(false);
  };

  const handleClearSelection = () => {
    setSelectedMedia(null);
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
                  const isSelected = selectedMedia === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setSelectedMedia(isSelected ? null : item.id)
                      }
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
                            <Check className="size-4 text-primary-foreground" />
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
        <DialogFooter className="shrink-0 gap-2 sm:gap-0">
          {selectedMedia && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleClearSelection}
              className="mr-auto"
            >
              <X className="mr-2 size-4" />
              Clear Selection
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
            {selectedMedia ? "Select Image" : "No Image"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
