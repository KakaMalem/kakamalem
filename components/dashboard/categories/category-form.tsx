"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { X, Loader2, ImageIcon, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  UnifiedMediaSelector,
  type MediaSelection,
} from "@/components/dashboard/media/unified-media-selector";
import { useImagePreview } from "@/components/ui/image-preview";

import type { Category, Media } from "@/lib/db/schema";
import {
  categorySchema,
  generateCategorySlug,
  type CategoryInput,
} from "@/lib/validations/categories";
import {
  createCategoryWithUrl,
  updateCategoryWithUrl,
} from "@/lib/actions/categories";
import { handleFormErrors } from "@/lib/utils/form-errors";

type ImageState = {
  id: string;
  url: string;
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
  const { openPreview } = useImagePreview();

  // Form state
  const [name, setName] = useState(category?.name || "");
  const [slug, setSlug] = useState(category?.slug || "");
  const [description, setDescription] = useState(category?.description || "");

  // Image state - always from media library
  const [image, setImage] = useState<ImageState | null>(() => {
    if (category?.image) {
      return {
        id: category.imageId || "",
        url: category.image.url,
      };
    }
    return null;
  });

  const handleNameChange = (value: string) => {
    setName(value);
    // Auto-generate slug if not manually edited (only for new categories)
    if (!category) {
      setSlug(generateCategorySlug(value));
    }
  };

  const handleMediaSelect = (media: MediaSelection | null) => {
    if (media) {
      setImage({
        id: media.id,
        url: media.url,
      });
    } else {
      setImage(null);
    }
  };

  const removeImage = () => {
    setImage(null);
  };

  // Scroll to first error field when errors change
  useEffect(() => {
    const errorFields = Object.keys(errors);
    if (errorFields.length === 0) return;

    const firstErrorField = errorFields[0];
    const element = document.getElementById(firstErrorField);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => element.focus(), 300);
    }
  }, [errors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const formData: CategoryInput = {
      name,
      slug,
      description,
      imageId: image?.id || "",
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
      handleFormErrors(fieldErrors);
      return;
    }

    // Use startTransition to show pending state
    startTransition(async () => {
      try {
        let actionResult;

        if (category) {
          actionResult = await updateCategoryWithUrl(
            tenantId,
            category.id,
            formData,
            null // No longer passing uploaded URL since media is already in library
          );
        } else {
          actionResult = await createCategoryWithUrl(tenantId, formData, null);
        }

        if (actionResult.success) {
          toast.success(category ? "Category updated" : "Category created");
          // Use window.location for immediate navigation that exits transition
          window.location.href = `/dashboard/${storeSlug}/categories`;
        } else {
          if (actionResult.error?.field) {
            setErrors({
              [actionResult.error.field]: actionResult.error.message,
            });
            toast.error(actionResult.error.message);
          } else {
            toast.error(actionResult.error?.message || "Something went wrong");
          }
        }
      } catch (error) {
        console.error("Error in form submission:", error);
        toast.error("Something went wrong. Please try again.");
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
                  <div className="group relative aspect-video overflow-hidden rounded-lg border bg-muted">
                    <button
                      type="button"
                      onClick={() =>
                        openPreview(
                          [{ src: image.url, alt: name || "Category image" }],
                          0
                        )
                      }
                      className="absolute inset-0 w-full h-full cursor-zoom-in"
                    >
                      <Image
                        src={image.url}
                        alt={name || "Category image"}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                        <Eye className="size-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm z-10"
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
                    {image ? "Change Image" : "Select Image"}
                  </Button>
                </div>

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
      <UnifiedMediaSelector
        tenantId={tenantId}
        open={mediaSelectorOpen}
        onOpenChange={setMediaSelectorOpen}
        multiple={false}
        onSelect={handleMediaSelect}
        selectedId={image?.id || null}
        title="Select Category Image"
      />
    </form>
  );
}
