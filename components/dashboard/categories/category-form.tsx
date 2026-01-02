"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MediaSelector } from "@/components/dashboard/media/media-selector";

import type { Category, Media } from "@/lib/db/schema";
import {
  categorySchema,
  generateCategorySlug,
  type CategoryInput,
} from "@/lib/validations/categories";
import {
  createCategoryWithImage,
  updateCategoryWithImage,
} from "@/lib/supabase/categories";

// Image can be either from media library (existing) or staged (new upload)
type ImageState = {
  id: string; // For existing: media ID. For staged: empty string
  url: string; // For existing: media URL. For staged: object URL
  file?: File; // Only for staged uploads
  isStaged?: boolean; // True for new uploads not yet saved
};

interface CategoryFormProps {
  tenantId: string;
  storeSlug: string;
  category?: Category & { image?: Media | null };
}

type FormErrors = Partial<Record<keyof CategoryInput, string>>;

export function CategoryForm({
  tenantId,
  storeSlug,
  category,
}: CategoryFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FormErrors>({});
  const [mediaSelectorOpen, setMediaSelectorOpen] = useState(false);

  // Form state
  const [name, setName] = useState(category?.name || "");
  const [slug, setSlug] = useState(category?.slug || "");
  const [description, setDescription] = useState(category?.description || "");

  // Image state - can be existing (from media library) or staged (new upload)
  const [image, setImage] = useState<ImageState | null>(() => {
    if (category?.image) {
      return {
        id: category.imageId || "",
        url: category.image.url,
        isStaged: false,
      };
    }
    return null;
  });

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (image?.isStaged && image.url) {
        URL.revokeObjectURL(image.url);
      }
    };
  }, [image]);

  const handleNameChange = (value: string) => {
    setName(value);
    // Auto-generate slug if not manually edited (only for new categories)
    if (!category) {
      setSlug(generateCategorySlug(value));
    }
  };

  // Stage image locally instead of uploading immediately
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    // Clean up previous staged image URL if any
    if (image?.isStaged && image.url) {
      URL.revokeObjectURL(image.url);
    }

    // Create object URL for preview
    const previewUrl = URL.createObjectURL(file);
    setImage({
      id: "",
      url: previewUrl,
      file,
      isStaged: true,
    });
    toast.success("Image added");
    e.target.value = "";
  };

  const handleMediaSelect = (media: { id: string; url: string } | null) => {
    // Clean up previous staged image URL if any
    if (image?.isStaged && image.url) {
      URL.revokeObjectURL(image.url);
    }

    if (media) {
      setImage({
        id: media.id,
        url: media.url,
        isStaged: false,
      });
    } else {
      setImage(null);
    }
  };

  const removeImage = () => {
    // Clean up object URL if staged
    if (image?.isStaged && image.url) {
      URL.revokeObjectURL(image.url);
    }
    setImage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Determine existing image ID (only if not staged)
    const existingImageId = image && !image.isStaged ? image.id : "";

    const formData: CategoryInput = {
      name,
      slug,
      description,
      imageId: existingImageId,
      displayOrder: category?.displayOrder ?? 0,
    };

    // Validate
    const result = categorySchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof CategoryInput;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    // Get staged file if any
    const stagedFile = image?.isStaged && image.file ? image.file : null;

    startTransition(async () => {
      let actionResult;

      if (category) {
        actionResult = await updateCategoryWithImage(
          tenantId,
          category.id,
          formData,
          stagedFile
        );
      } else {
        actionResult = await createCategoryWithImage(
          tenantId,
          formData,
          stagedFile
        );
      }

      if (actionResult.success) {
        toast.success(category ? "Category updated" : "Category created");
        router.push(`/dashboard/${storeSlug}/categories`);
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

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-8 lg:col-span-2">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Category Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Category Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Enter category name"
                  aria-invalid={!!errors.name}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">
                  Category URL <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    /store/{storeSlug}/category/
                  </span>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    placeholder="category-url"
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
                  placeholder="Describe this category..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Category Image */}
          <Card>
            <CardHeader>
              <CardTitle>Category Image</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {image ? (
                  <div className="relative aspect-video overflow-hidden rounded-lg border bg-muted">
                    <Image
                      src={image.url}
                      alt={name || "Category image"}
                      fill
                      className="object-cover"
                      unoptimized={image.isStaged}
                    />
                    {/* Show "New" badge for staged images */}
                    {image.isStaged && (
                      <Badge className="absolute left-2 top-2">New</Badge>
                    )}
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-muted/30">
                    <div className="rounded-full bg-muted p-3">
                      <ImageIcon className="size-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      No image selected
                    </p>
                  </div>
                )}

                {/* Image Actions */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
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
                      onChange={handleImageUpload}
                      className="sr-only"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
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

                {/* Message about staged uploads */}
                {image?.isStaged && (
                  <p className="text-sm text-muted-foreground">
                    Image will be uploaded when you save the category.
                  </p>
                )}

                <p className="text-sm text-muted-foreground">
                  This image will be displayed on the category page and in
                  listings.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/dashboard/${storeSlug}/categories`)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {category ? "Saving..." : "Creating..."}
            </>
          ) : category ? (
            "Save Changes"
          ) : (
            "Create Category"
          )}
        </Button>
      </div>

      {/* Media Selector Dialog */}
      <MediaSelector
        tenantId={tenantId}
        open={mediaSelectorOpen}
        onOpenChange={setMediaSelectorOpen}
        onSelect={handleMediaSelect}
        selectedId={image && !image.isStaged ? image.id : undefined}
        title="Select Category Image"
      />
    </form>
  );
}
