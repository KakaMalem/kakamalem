"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  Upload,
  X,
  GripVertical,
  Loader2,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MediaSelector } from "@/components/dashboard/media/media-selector";

import type { Category, Product, Media } from "@/lib/db/schema";
import {
  productSchema,
  generateProductSlug,
  type ProductInput,
} from "@/lib/validations/products";
import {
  createProductWithImages,
  updateProductWithImages,
} from "@/lib/supabase/products";

interface ProductFormProps {
  tenantId: string;
  storeSlug: string;
  categories: Category[];
  currency: string;
  product?: Product & {
    images?: { media: Media; position: number }[];
  };
}

type FormErrors = Partial<Record<keyof ProductInput, string>>;

// Image can be either an existing media item or a staged file
type ImageItem = {
  id: string; // For existing: media ID. For staged: temp ID
  url: string; // For existing: media URL. For staged: object URL
  altText?: string | null;
  file?: File; // Only for staged uploads
  isStaged?: boolean; // True for new uploads not yet saved
};

export function ProductForm({
  tenantId,
  storeSlug,
  categories,
  currency,
  product,
}: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FormErrors>({});
  const [mediaSelectorOpen, setMediaSelectorOpen] = useState(false);

  // Image drag state (mouse)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Touch drag state
  const [touchDragIndex, setTouchDragIndex] = useState<number | null>(null);
  const [touchOverIndex, setTouchOverIndex] = useState<number | null>(null);
  const touchStartX = useRef<number>(0);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Form state
  const [name, setName] = useState(product?.name || "");
  const [slug, setSlug] = useState(product?.slug || "");
  const [description, setDescription] = useState(product?.description || "");
  const [price, setPrice] = useState(product?.price || "");
  const [categoryId, setCategoryId] = useState(product?.categoryId || "");
  const [trackInventory, setTrackInventory] = useState(
    product?.trackInventory ?? true
  );
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [allowBackorder, setAllowBackorder] = useState(
    product?.allowBackorder ?? false
  );
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(product?.lowStockThreshold ?? 0)
  );
  const [weight, setWeight] = useState(product?.weight || "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);

  // Images state - now includes both existing and staged images
  const [images, setImages] = useState<ImageItem[]>(
    product?.images?.map((img) => ({
      id: img.media.id,
      url: img.media.url,
      altText: img.media.altText,
      isStaged: false,
    })) || []
  );

  // Clean up object URLs when component unmounts or when staged images are removed
  useEffect(() => {
    return () => {
      // Revoke all object URLs for staged images on unmount
      images.forEach((img) => {
        if (img.isStaged && img.url.startsWith("blob:")) {
          URL.revokeObjectURL(img.url);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNameChange = (value: string) => {
    setName(value);
    // Auto-generate slug if not manually edited
    if (!product) {
      setSlug(generateProductSlug(value));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: ImageItem[] = [];

    for (const file of Array.from(files)) {
      // Validate file
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 5MB)`);
        continue;
      }

      // Create a temporary ID and object URL for preview
      const tempId = `staged-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 11)}`;
      const previewUrl = URL.createObjectURL(file);

      newImages.push({
        id: tempId,
        url: previewUrl,
        file,
        isStaged: true,
      });
    }

    if (newImages.length > 0) {
      setImages((prev) => [...prev, ...newImages]);
      toast.success(
        `${newImages.length} image${newImages.length > 1 ? "s" : ""} added`
      );
    }

    // Reset input
    e.target.value = "";
  };

  const removeImage = (imageId: string) => {
    setImages((prev) => {
      const imageToRemove = prev.find((img) => img.id === imageId);
      // Revoke object URL if it's a staged image
      if (imageToRemove?.isStaged && imageToRemove.url.startsWith("blob:")) {
        URL.revokeObjectURL(imageToRemove.url);
      }
      return prev.filter((img) => img.id !== imageId);
    });
  };

  const handleMediaSelect = (media: { id: string; url: string } | null) => {
    if (media) {
      // Check if image already exists
      if (images.some((img) => img.id === media.id)) {
        toast.error("This image is already added");
        return;
      }
      setImages((prev) => [
        ...prev,
        {
          id: media.id,
          url: media.url,
          isStaged: false, // Existing media, not staged
        },
      ]);
    }
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= images.length) return;
    const newImages = [...images];
    const [removed] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, removed);
    setImages(newImages);
  };

  // Mouse drag handlers for images
  const handleImageDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleImageDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleImageDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null) {
      moveImage(draggedIndex, dragOverIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Touch drag handlers for images
  const handleImageTouchStart = (e: React.TouchEvent, index: number) => {
    const target = e.target as HTMLElement;
    if (!target.closest("[data-image-drag-handle]")) return;

    e.preventDefault();
    setTouchDragIndex(index);
    touchStartX.current = e.touches[0].clientX;
  };

  const handleImageTouchMove = (e: React.TouchEvent) => {
    if (touchDragIndex === null) return;

    const touchX = e.touches[0].clientX;

    // Find which image we're over
    for (let i = 0; i < imageRefs.current.length; i++) {
      const ref = imageRefs.current[i];
      if (ref) {
        const rect = ref.getBoundingClientRect();
        if (touchX >= rect.left && touchX <= rect.right) {
          if (i !== touchDragIndex) {
            setTouchOverIndex(i);
          }
          break;
        }
      }
    }
  };

  const handleImageTouchEnd = () => {
    if (touchDragIndex !== null && touchOverIndex !== null) {
      moveImage(touchDragIndex, touchOverIndex);
    }
    setTouchDragIndex(null);
    setTouchOverIndex(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Separate existing media IDs and staged files
    const existingImageIds = images
      .filter((img) => !img.isStaged)
      .map((img) => img.id);
    const stagedFiles = images
      .filter((img) => img.isStaged && img.file)
      .map((img) => img.file!);

    const formData: ProductInput = {
      name,
      slug,
      description,
      price,
      categoryId: categoryId || "",
      trackInventory,
      stock,
      allowBackorder,
      lowStockThreshold,
      weight,
      isActive,
      displayOrder: String(product?.displayOrder ?? 0),
      imageIds: existingImageIds, // Only existing media IDs
    };

    // Validate
    const result = productSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof ProductInput;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    startTransition(async () => {
      let actionResult;

      if (product) {
        actionResult = await updateProductWithImages(
          tenantId,
          product.id,
          formData,
          stagedFiles
        );
      } else {
        actionResult = await createProductWithImages(
          tenantId,
          formData,
          stagedFiles
        );
      }

      if (actionResult.success) {
        // Clean up object URLs for staged images on success
        images.forEach((img) => {
          if (img.isStaged && img.url.startsWith("blob:")) {
            URL.revokeObjectURL(img.url);
          }
        });

        toast.success(product ? "Product updated" : "Product created");
        router.push(`/dashboard/${storeSlug}/products`);
        router.refresh();
      } else {
        if (actionResult.error?.field) {
          setErrors({ [actionResult.error.field]: actionResult.error.message });
        } else {
          toast.error(actionResult.error?.message || "Something went wrong");
        }
      }
    });
  };

  const hasStagedImages = images.some((img) => img.isStaged);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-8 lg:col-span-2">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Product Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Enter product name"
                  aria-invalid={!!errors.name}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">
                  Product URL <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    /store/{storeSlug}/product/
                  </span>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    placeholder="product-url"
                    className="flex-1"
                    aria-invalid={!!errors.slug}
                  />
                </div>
                {errors.slug && (
                  <p className="text-sm text-destructive">{errors.slug}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your product..."
                  rows={5}
                />
              </div>
            </CardContent>
          </Card>

          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Image Grid */}
                {images.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                    {images.map((image, index) => {
                      const isDragging =
                        draggedIndex === index || touchDragIndex === index;
                      const isDragOver =
                        dragOverIndex === index || touchOverIndex === index;

                      return (
                        <div
                          key={image.id}
                          ref={(el) => {
                            imageRefs.current[index] = el;
                          }}
                          draggable
                          onDragStart={() => handleImageDragStart(index)}
                          onDragOver={(e) => handleImageDragOver(e, index)}
                          onDragEnd={handleImageDragEnd}
                          onTouchStart={(e) => handleImageTouchStart(e, index)}
                          onTouchMove={handleImageTouchMove}
                          onTouchEnd={handleImageTouchEnd}
                          className={`group relative aspect-square overflow-hidden rounded-lg border bg-muted transition-all ${
                            isDragging ? "opacity-50 scale-95" : ""
                          } ${
                            isDragOver
                              ? "ring-2 ring-primary ring-offset-2"
                              : ""
                          }`}
                        >
                          <Image
                            src={image.url}
                            alt={image.altText || `Product image ${index + 1}`}
                            fill
                            className="object-cover pointer-events-none"
                            unoptimized={image.isStaged} // Skip optimization for blob URLs
                          />
                          {index === 0 && (
                            <span className="absolute left-2 top-2 rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                              Main
                            </span>
                          )}
                          {image.isStaged && (
                            <span className="absolute right-2 top-2 rounded bg-amber-500 px-2 py-0.5 text-xs font-medium text-white">
                              New
                            </span>
                          )}
                          {/* Drag handle overlay */}
                          <div
                            data-image-drag-handle
                            className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                          >
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
                              size="icon-sm"
                              onClick={() => moveImage(index, index - 1)}
                              disabled={index === 0}
                              title="Move left"
                            >
                              <ChevronLeft className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon-sm"
                              onClick={() => moveImage(index, index + 1)}
                              disabled={index === images.length - 1}
                              title="Move right"
                            >
                              <ChevronRight className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon-sm"
                              onClick={() => removeImage(image.id)}
                              title="Remove"
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Image Actions */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setMediaSelectorOpen(true)}
                  >
                    <ImageIcon className="mr-2 size-4" />
                    Select from Library
                  </Button>
                  <label className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="sr-only"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      asChild
                    >
                      <span className="cursor-pointer">
                        <Upload className="mr-2 size-4" />
                        Upload New
                      </span>
                    </Button>
                  </label>
                </div>

                <p className="text-sm text-muted-foreground">
                  The first image will be used as the main product image.
                  {hasStagedImages && (
                    <span className="block mt-1 text-amber-600">
                      New images will be uploaded when you save the product.
                    </span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="price">
                  Price ({currency}) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  aria-invalid={!!errors.price}
                />
                {errors.price && (
                  <p className="text-sm text-destructive">{errors.price}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Inventory */}
          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Track Inventory</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable stock tracking for this product
                  </p>
                </div>
                <Switch
                  checked={trackInventory}
                  onCheckedChange={setTrackInventory}
                />
              </div>

              {trackInventory && (
                <>
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="stock">Stock Quantity</Label>
                      <Input
                        id="stock"
                        type="number"
                        min="0"
                        value={stock}
                        onChange={(e) => setStock(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lowStockThreshold">
                        Low Stock Threshold
                      </Label>
                      <Input
                        id="lowStockThreshold"
                        type="number"
                        min="0"
                        value={lowStockThreshold}
                        onChange={(e) => setLowStockThreshold(e.target.value)}
                        placeholder="5"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Allow Backorders</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow orders when out of stock
                      </p>
                    </div>
                    <Switch
                      checked={allowBackorder}
                      onCheckedChange={setAllowBackorder}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Shipping */}
          <Card>
            <CardHeader>
              <CardTitle>Shipping</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.001"
                  min="0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0.000"
                />
                <p className="text-sm text-muted-foreground">
                  Used for calculating shipping rates
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Active</Label>
                  <p className="text-sm text-muted-foreground">
                    Show product in your store
                  </p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </CardContent>
          </Card>

          {/* Category */}
          <Card>
            <CardHeader>
              <CardTitle>Category</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={categoryId || "none"}
                onValueChange={(value) =>
                  setCategoryId(value === "none" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/dashboard/${storeSlug}/products`)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {hasStagedImages
                ? "Uploading..."
                : product
                ? "Saving..."
                : "Creating..."}
            </>
          ) : product ? (
            "Save Changes"
          ) : (
            "Create Product"
          )}
        </Button>
      </div>

      {/* Media Selector Dialog */}
      <MediaSelector
        tenantId={tenantId}
        open={mediaSelectorOpen}
        onOpenChange={setMediaSelectorOpen}
        onSelect={handleMediaSelect}
        title="Select Product Image"
      />
    </form>
  );
}
