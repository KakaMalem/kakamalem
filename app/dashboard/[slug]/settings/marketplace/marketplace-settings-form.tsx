"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  Store,
  Globe,
  ExternalLink,
  Upload,
  X,
  Plus,
  ImageIcon,
  ShoppingBag,
  Check,
} from "lucide-react";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import { updateMarketplaceProfile } from "@/lib/actions/marketplace";
import {
  MAX_SIZES,
  formatFileSize,
  UPLOAD_ERROR_MESSAGES,
} from "@/lib/config/file-validation";

// ---------- Types ----------

type ImageState = {
  url: string;
  file?: File;
  isStaged?: boolean;
};

type UploadProgress = {
  isUploading: boolean;
  progress: number;
};

interface MarketplaceSettingsFormProps {
  storeId: string;
  storeSlug: string;
  marketplaceEnabled: boolean;
  profile: {
    coverImage: string | null;
    tags: string[];
    featuredProductIds: string[];
    priceRange: number;
    categoryIds: string[];
  };
  platformCategories: Array<{
    id: string;
    slug: string;
    name: string;
    icon: string | null;
    storeCount: number;
  }>;
  storeProducts: Array<{
    id: string;
    name: string;
    imageUrl: string | null;
  }>;
}

// ---------- Component ----------

export function MarketplaceSettingsForm({
  storeId,
  storeSlug,
  marketplaceEnabled: initialEnabled,
  profile,
  platformCategories,
  storeProducts,
}: MarketplaceSettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Toggle
  const [enabled, setEnabled] = useState(initialEnabled);

  // Cover image
  const [cover, setCover] = useState<ImageState | null>(() =>
    profile.coverImage ? { url: profile.coverImage, isStaged: false } : null
  );
  const [coverUploadProgress, setCoverUploadProgress] =
    useState<UploadProgress>({ isUploading: false, progress: 0 });

  // Categories
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    profile.categoryIds
  );

  // Tags
  const [tags, setTags] = useState<string[]>(profile.tags);
  const [tagInput, setTagInput] = useState("");

  // Featured products
  const [featuredIds, setFeaturedIds] = useState<string[]>(
    profile.featuredProductIds
  );

  // Price range
  const [priceRange, setPriceRange] = useState(profile.priceRange);

  // Upload helper
  const uploadFileWithProgress = useCallback(
    (
      file: File,
      folder: string,
      onProgress: (progress: number) => void
    ): Promise<string | null> => {
      return new Promise((resolve) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("tenantId", storeId);
        formData.append("folder", folder);

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const progress = Math.min(
              95,
              Math.round((e.loaded / e.total) * 95)
            );
            onProgress(progress);
          }
        });

        xhr.addEventListener("load", () => {
          onProgress(100);
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText) as {
                success: boolean;
                file?: { url: string };
                error?: string;
              };
              if (response.success && response.file?.url) {
                resolve(response.file.url);
              } else {
                toast.error(
                  response.error || UPLOAD_ERROR_MESSAGES.unknownError
                );
                resolve(null);
              }
            } catch {
              toast.error(UPLOAD_ERROR_MESSAGES.serverError);
              resolve(null);
            }
          } else {
            if (xhr.status === 413) {
              toast.error(
                UPLOAD_ERROR_MESSAGES.fileTooLarge(
                  formatFileSize(MAX_SIZES.logos)
                )
              );
            } else {
              toast.error(UPLOAD_ERROR_MESSAGES.serverError);
            }
            resolve(null);
          }
        });

        xhr.addEventListener("error", () => {
          toast.error(UPLOAD_ERROR_MESSAGES.networkError);
          resolve(null);
        });

        xhr.timeout = 120000;
        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });
    },
    [storeId]
  );

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (cover?.isStaged && cover.url) URL.revokeObjectURL(cover.url);
    };
  }, [cover]);

  function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(UPLOAD_ERROR_MESSAGES.invalidType);
      return;
    }

    if (file.size > MAX_SIZES.logos) {
      toast.error(
        UPLOAD_ERROR_MESSAGES.fileTooLarge(formatFileSize(MAX_SIZES.logos))
      );
      return;
    }

    if (cover?.isStaged && cover.url) URL.revokeObjectURL(cover.url);

    const previewUrl = URL.createObjectURL(file);
    setCover({ url: previewUrl, file, isStaged: true });
    e.target.value = "";
  }

  function removeCover() {
    if (cover?.isStaged && cover.url) URL.revokeObjectURL(cover.url);
    setCover(null);
  }

  function toggleCategory(catId: string) {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId)
        ? prev.filter((id) => id !== catId)
        : [...prev, catId]
    );
  }

  function addTag() {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < 10) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function toggleFeaturedProduct(productId: string) {
    setFeaturedIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      }
      if (prev.length >= 6) {
        toast.error("You can feature up to 6 products");
        return prev;
      }
      return [...prev, productId];
    });
  }

  const isUploading = coverUploadProgress.isUploading;

  async function handleSave() {
    try {
      // Upload cover image if staged
      let coverUrl = cover && !cover.isStaged ? cover.url : null;

      if (cover?.isStaged && cover.file) {
        setCoverUploadProgress({ isUploading: true, progress: 0 });
        const url = await uploadFileWithProgress(
          cover.file,
          "media",
          (progress) => {
            setCoverUploadProgress({ isUploading: true, progress });
          }
        );
        setCoverUploadProgress({ isUploading: false, progress: 0 });

        if (!url) return;
        coverUrl = url;

        if (cover.url) URL.revokeObjectURL(cover.url);
        setCover({ url: coverUrl, isStaged: false });
      }

      startTransition(async () => {
        const result = await updateMarketplaceProfile(storeId, storeSlug, {
          marketplaceEnabled: enabled,
          coverImage: coverUrl,
          tags,
          featuredProductIds: featuredIds,
          priceRange,
          categoryIds: selectedCategoryIds,
        });

        if (result.error) {
          toast.error(result.error.message);
        } else {
          toast.success("Marketplace settings saved!");
          router.refresh();
        }
      });
    } catch {
      setCoverUploadProgress({ isUploading: false, progress: 0 });
      toast.error("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Marketplace</h2>
        <p className="text-sm text-muted-foreground">
          Customize how your store appears on the Kaka Malem marketplace.
        </p>
      </div>

      {/* Toggle Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="size-5" />
            Marketplace Listing
          </CardTitle>
          <CardDescription>
            When enabled, your store will appear on the{" "}
            <Link
              href="/marketplace"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Kaka Malem Marketplace
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <Store className="mt-0.5 size-5 text-muted-foreground" />
              <div>
                <Label
                  htmlFor="marketplace-toggle"
                  className="text-sm font-medium"
                >
                  Show on Marketplace
                </Label>
                <p className="text-sm text-muted-foreground">
                  Your store, products, and ratings will be visible to
                  marketplace browsers.
                </p>
              </div>
            </div>
            <Switch
              id="marketplace-toggle"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {enabled && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              <p className="font-medium">Your store will be visible at:</p>
              <Link
                href={`/marketplace/stores/${storeSlug}`}
                target="_blank"
                className="mt-1 inline-flex items-center gap-1 text-green-700 underline-offset-4 hover:underline"
              >
                kakamalem.com/marketplace/stores/{storeSlug}
                <ExternalLink className="size-3" />
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cover Image */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="size-5" />
            Cover Image
          </CardTitle>
          <CardDescription>
            A banner image displayed at the top of your marketplace profile.
            Recommended: 1200x400px.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cover ? (
            <div className="relative">
              <div className="relative aspect-3/1 w-full overflow-hidden rounded-lg border bg-muted/30">
                <Image
                  src={cover.url}
                  alt="Cover image"
                  fill
                  className="object-cover"
                  unoptimized={cover.isStaged}
                />
                {cover.isStaged && (
                  <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                    New
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={removeCover}
                className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm"
                disabled={isPending || isUploading}
              >
                <X className="size-4" />
              </button>
              <div className="mt-3 flex justify-center">
                <label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    className="sr-only"
                    disabled={isPending || isUploading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    asChild
                    disabled={isPending || isUploading}
                  >
                    <span className="cursor-pointer">
                      <Upload className="mr-2 size-4" />
                      Change Cover
                    </span>
                  </Button>
                </label>
              </div>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed bg-muted/50 py-12 transition-colors hover:border-muted-foreground/50">
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                className="sr-only"
                disabled={isPending || isUploading}
              />
              <div className="text-center">
                <Upload className="mx-auto mb-2 size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload a cover image
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PNG, JPG up to {formatFileSize(MAX_SIZES.logos)}
                </p>
              </div>
            </label>
          )}
          {coverUploadProgress.isUploading && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Uploading cover...
                </span>
                <span className="text-muted-foreground">
                  {coverUploadProgress.progress}%
                </span>
              </div>
              <Progress value={coverUploadProgress.progress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Categories */}
      {platformCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Store Categories</CardTitle>
            <CardDescription>
              Select categories that best describe your store. This helps
              customers find you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {platformCategories.map((cat) => {
                const selected = selectedCategoryIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    disabled={isPending || isUploading}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {cat.icon && <span>{cat.icon}</span>}
                    {cat.name}
                    {selected && <Check className="size-3.5" />}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>
            Add up to 10 tags to help customers discover your store. Press Enter
            to add.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
                  disabled={isPending || isUploading}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="e.g. handmade, organic, kabul"
              disabled={isPending || isUploading || tags.length >= 10}
              className="max-w-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addTag}
              disabled={
                isPending ||
                isUploading ||
                !tagInput.trim() ||
                tags.length >= 10
              }
            >
              <Plus className="mr-1 size-3.5" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Price Range */}
      <Card>
        <CardHeader>
          <CardTitle>Price Range</CardTitle>
          <CardDescription>
            Give visitors a general idea of your pricing level.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {[
              { value: 1, label: "$", desc: "Budget-friendly" },
              { value: 2, label: "$$", desc: "Mid-range" },
              { value: 3, label: "$$$", desc: "Premium" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPriceRange(option.value)}
                disabled={isPending || isUploading}
                className={cn(
                  "flex flex-col items-center rounded-lg border px-6 py-3 transition-colors",
                  priceRange === option.value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span className="text-lg font-bold">{option.label}</span>
                <span className="mt-0.5 text-xs">{option.desc}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Featured Products */}
      {storeProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="size-5" />
              Featured Products
            </CardTitle>
            <CardDescription>
              Choose up to 6 products to showcase on your marketplace profile.
              If none are selected, your newest products will be shown.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {featuredIds.length > 0 && (
              <p className="mb-3 text-xs text-muted-foreground">
                {featuredIds.length}/6 selected
              </p>
            )}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {storeProducts.map((product) => {
                const selected = featuredIds.includes(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => toggleFeaturedProduct(product.id)}
                    disabled={isPending || isUploading}
                    className={cn(
                      "group relative flex flex-col overflow-hidden rounded-lg border transition-all",
                      selected
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="relative aspect-square bg-muted/30">
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="100px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ShoppingBag className="size-5 text-muted-foreground/30" />
                        </div>
                      )}
                      {selected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                          <div className="rounded-full bg-primary p-1">
                            <Check className="size-3.5 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="line-clamp-1 p-1.5 text-[11px] font-medium">
                      {product.name}
                    </p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isPending || isUploading}
          size="lg"
        >
          {(isPending || isUploading) && <Spinner className="mr-2" />}
          {isUploading
            ? "Uploading..."
            : isPending
              ? "Saving..."
              : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
