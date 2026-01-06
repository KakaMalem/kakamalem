"use client";

import {
  useState,
  useTransition,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
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
  Plus,
  Check,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
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
import { EnhancedMediaPicker } from "@/components/dashboard/media/enhanced-media-picker";
import {
  VariantOptionsBuilder,
  type ExistingOption,
} from "@/components/dashboard/products/variant-options-builder";
import { VariantMatrixTable } from "@/components/dashboard/products/variant-matrix-table";

import type { Category, Product, Media } from "@/lib/db/schema";
import { productSchema, type ProductInput } from "@/lib/validations/products";
import type {
  InlineOption,
  GeneratedVariant,
} from "@/lib/validations/variant-form";
import {
  createProductWithImages,
  updateProductWithImages,
} from "@/lib/supabase/products";
import {
  createProductVariantsInBulk,
  updateProductVariantsInBulk,
} from "@/lib/supabase/variants";
import { cn } from "@/lib/utils";
import {
  generateVariantCombinations,
  generateSku,
  validateVariantCount,
} from "@/lib/variants/cartesian";

interface ProductFormProps {
  tenantId: string;
  storeSlug: string;
  categories: Category[];
  currency: string;
  product?: Product & {
    images?: { media: Media; position: number }[];
    productCategories?: { categoryId: string }[];
  };
  /** Existing variant options for this tenant (for autocomplete) */
  existingVariantOptions?: ExistingOption[];
  /** Initial variant options if editing a product with variants */
  initialVariantOptions?: InlineOption[];
  /** Initial variants if editing a product with variants */
  initialVariants?: GeneratedVariant[];
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
  existingVariantOptions = [],
  initialVariantOptions = [],
  initialVariants = [],
}: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FormErrors>({});
  const [mediaSelectorOpen, setMediaSelectorOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    stage: "validating" | "uploading" | "saving" | "complete";
    message: string;
  } | null>(null);

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
  const [description, setDescription] = useState(product?.description || "");
  // Note: slug is now auto-generated on the backend, no need to manage it here
  const [price, setPrice] = useState(product?.price || "");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(product?.productCategories?.map((pc) => pc.categoryId) || [])
  );
  const availableCategories = categories;
  const [trackInventory, setTrackInventory] = useState(
    product?.trackInventory ?? false
  );
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [allowBackorder, setAllowBackorder] = useState(
    product?.allowBackorder ?? false
  );
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(product?.lowStockThreshold ?? 0)
  );
  const [showStock, setShowStock] = useState(product?.showStock ?? false);
  const [weight, setWeight] = useState(product?.weight || "");
  const [length, setLength] = useState(product?.length || "");
  const [width, setWidth] = useState(product?.width || "");
  const [height, setHeight] = useState(product?.height || "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);

  // Variant state
  const [hasVariants, setHasVariants] = useState(product?.hasVariants ?? false);
  const [variantOptions, setVariantOptions] = useState<InlineOption[]>(
    initialVariantOptions
  );
  const [variants, setVariants] = useState<GeneratedVariant[]>(initialVariants);
  const [variantError, setVariantError] = useState<string | null>(null);
  const [showDisableVariantsDialog, setShowDisableVariantsDialog] =
    useState(false);

  // Category input state
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categorySearchInput, setCategorySearchInput] = useState("");
  const categoryInputRef = useRef<HTMLInputElement>(null);

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

  // Removed old handleNameChange - now using useSlug hook

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Filtered categories based on search input
  const filteredCategories = useMemo(() => {
    if (!categorySearchInput.trim()) return availableCategories;
    return availableCategories.filter((cat) =>
      cat.name.toLowerCase().includes(categorySearchInput.toLowerCase())
    );
  }, [availableCategories, categorySearchInput]);

  const handleCategoryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // If there's text in the input, create the category first
      if (categorySearchInput.trim()) {
        e.preventDefault();
        e.stopPropagation();
        handleCreateNewCategory();
        // Don't submit form - user needs to press Enter again or click submit
        return;
      }
      // If input is empty, allow the Enter to propagate to form submission
      // (the form's onSubmit will handle it)
    }

    // Remove last category on Backspace when input is empty
    if (
      e.key === "Backspace" &&
      !categorySearchInput &&
      selectedCategories.size > 0
    ) {
      e.preventDefault();
      const categoriesArray = Array.from(selectedCategories);
      const lastCategoryId = categoriesArray[categoriesArray.length - 1];
      toggleCategory(lastCategoryId);
    }

    // Close dropdown on Escape
    if (e.key === "Escape") {
      setShowCategoryDropdown(false);
      categoryInputRef.current?.blur();
    }
  };

  const handleSelectCategory = (categoryId: string) => {
    toggleCategory(categoryId);
    setCategorySearchInput("");
    // Close dropdown and refocus input
    setShowCategoryDropdown(false);
    setTimeout(() => {
      categoryInputRef.current?.focus();
    }, 0);
  };

  const handleCreateNewCategory = () => {
    const trimmedName = categorySearchInput.trim();
    if (!trimmedName) return;

    // Check for duplicates (case-insensitive)
    const isDuplicate = availableCategories.some(
      (cat) => cat.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      toast.error("A category with this name already exists");
      return;
    }

    if (trimmedName.length < 2) {
      toast.error("Category name must be at least 2 characters");
      return;
    }

    // Generate a temporary ID for the new category
    const tempId = `temp-${Date.now()}`;
    const newCategory: Category = {
      id: tempId,
      tenantId: tenantId,
      name: trimmedName,
      slug: trimmedName.toLowerCase().replace(/\s+/g, "-"),
      description: null,
      imageId: null,
      displayOrder: availableCategories.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add to available categories
    categories.push(newCategory);

    // Auto-select the new category
    setSelectedCategories((prev) => new Set([...prev, tempId]));

    // Reset input, close dropdown, and refocus
    setCategorySearchInput("");
    setShowCategoryDropdown(false);
    setTimeout(() => {
      categoryInputRef.current?.focus();
    }, 0);

    toast.success(
      "Category added! It will be created when you save the product."
    );
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

  const handleMediaSelect = (media: { id: string; url: string }[]) => {
    // Filter out images that already exist
    const newImages = media.filter(
      (m) => !images.some((img) => img.id === m.id)
    );

    if (newImages.length === 0) {
      toast.error("Selected images are already added");
      return;
    }

    if (newImages.length < media.length) {
      toast.info(
        `${media.length - newImages.length} image${
          media.length - newImages.length !== 1 ? "s" : ""
        } already added`
      );
    }

    setImages((prev) => [
      ...prev,
      ...newImages.map((m) => ({
        id: m.id,
        url: m.url,
        isStaged: false, // Existing media, not staged
      })),
    ]);

    if (newImages.length > 0) {
      toast.success(
        `${newImages.length} image${newImages.length !== 1 ? "s" : ""} added`
      );
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

  // Handle variant options change - regenerate variants
  const handleVariantOptionsChange = useCallback(
    (newOptions: InlineOption[]) => {
      setVariantOptions(newOptions);
      setVariantError(null);

      // Check if all options have at least one value
      const validOptions = newOptions.filter(
        (opt) => opt.name.trim() && opt.values.length > 0
      );

      if (validOptions.length === 0) {
        setVariants([]);
        return;
      }

      // Prepare options for Cartesian product generation
      const optionsForGeneration = validOptions.map((opt) => ({
        optionId: opt.id || opt.tempId || `temp-${Date.now()}`,
        optionName: opt.name,
        values: opt.values.map((val) => ({
          valueId: val.id || val.value,
          value: val.value,
        })),
      }));

      // Generate combinations
      const combinations = generateVariantCombinations(optionsForGeneration);

      // Validate count
      const validation = validateVariantCount(combinations.length);
      if (validation.status === "error") {
        setVariantError(validation.message);
        return;
      }

      // Convert combinations to GeneratedVariant format
      // Preserve existing variant data where possible (matching by option values)
      const newVariants: GeneratedVariant[] = combinations.map((combo) => {
        // Try to find an existing variant with the same option values
        const existingVariant = variants.find((v) => {
          if (v.optionValues.length !== combo.optionValues.length) return false;
          return combo.optionValues.every((newOv) =>
            v.optionValues.some(
              (existingOv) =>
                existingOv.optionName === newOv.optionName &&
                existingOv.value === newOv.value
            )
          );
        });

        if (existingVariant) {
          // Preserve existing data but update option value refs
          return {
            ...existingVariant,
            optionValues: combo.optionValues,
            displayName: combo.displayName,
          };
        }

        // Create new variant with defaults
        return {
          tempId: combo.tempId,
          optionValues: combo.optionValues,
          displayName: combo.displayName,
          sku: generateSku(
            name || "product",
            combo.optionValues.map((ov) => ov.value)
          ),
          price: "", // Empty = use base price
          stock: "0",
          weight: "",
          length: "",
          width: "",
          height: "",
          description: "",
          imageIds: [],
          isActive: true,
          isExcluded: false,
        };
      });

      setVariants(newVariants);
    },
    [variants, name]
  );

  // Handle hasVariants toggle
  const handleHasVariantsChange = useCallback(
    (enabled: boolean) => {
      if (!enabled && (variantOptions.length > 0 || variants.length > 0)) {
        // Show confirmation dialog if there are variants to lose
        setShowDisableVariantsDialog(true);
      } else {
        setHasVariants(enabled);
        if (!enabled) {
          setVariantOptions([]);
          setVariants([]);
          setVariantError(null);
        }
      }
    },
    [variantOptions.length, variants.length]
  );

  // Confirm disabling variants
  const confirmDisableVariants = useCallback(() => {
    setHasVariants(false);
    setVariantOptions([]);
    setVariants([]);
    setVariantError(null);
    setShowDisableVariantsDialog(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("🚀 [handleSubmit] Form submission started");
    console.log(
      "📋 [handleSubmit] Selected categories:",
      Array.from(selectedCategories)
    );
    setErrors({});
    setVariantError(null);
    setUploadProgress({
      stage: "validating",
      message: "Validating product...",
    });

    // Validate variants if enabled
    if (hasVariants) {
      // Must have at least one option with values
      const validOptions = variantOptions.filter(
        (opt) => opt.name.trim() && opt.values.length > 0
      );
      if (validOptions.length === 0) {
        const errorMsg = "Please add at least one variant option with values";
        setVariantError(errorMsg);
        toast.error(errorMsg);
        setUploadProgress(null);
        return;
      }

      // Must have at least one non-excluded variant
      const activeVariants = variants.filter((v) => !v.isExcluded);
      if (activeVariants.length === 0) {
        const errorMsg = "Please include at least one variant";
        setVariantError(errorMsg);
        toast.error(errorMsg);
        setUploadProgress(null);
        return;
      }

      // Check variant count limit
      const validation = validateVariantCount(activeVariants.length);
      if (validation.status === "error") {
        setVariantError(validation.message);
        toast.error(validation.message);
        setUploadProgress(null);
        return;
      }
    }

    // Separate existing media IDs and staged files
    const existingImageIds = images
      .filter((img) => !img.isStaged)
      .map((img) => img.id);
    const stagedFiles = images
      .filter((img) => img.isStaged && img.file)
      .map((img) => img.file!);

    // Separate existing category IDs (UUIDs) from new category temp IDs
    // New categories will be created before product submission
    const existingCategoryIds = Array.from(selectedCategories).filter(
      (id) => !id.startsWith("temp-")
    );
    const newCategoryTempIds = Array.from(selectedCategories).filter((id) =>
      id.startsWith("temp-")
    );
    console.log(
      "📂 [handleSubmit] Existing category IDs:",
      existingCategoryIds
    );
    console.log("🆕 [handleSubmit] New category temp IDs:", newCategoryTempIds);

    const formData: ProductInput = {
      name,
      slug: "", // Auto-generated on the backend, empty string for validation
      description,
      price,
      // Only include existing (valid UUID) category IDs for initial validation
      // New categories will be created first, then their real IDs will be added
      categoryIds: existingCategoryIds,
      trackInventory, // Can be enabled/disabled for both simple and variant products
      stock: hasVariants ? "0" : stock,
      allowBackorder,
      lowStockThreshold,
      showStock,
      weight,
      length,
      width,
      height,
      isActive,
      displayOrder: String(product?.displayOrder ?? 0),
      imageIds: existingImageIds, // Only existing media IDs
    };

    // Validate
    console.log("🔍 [handleSubmit] Validating formData:", formData);
    const result = productSchema.safeParse(formData);
    if (!result.success) {
      console.log("❌ [handleSubmit] Validation failed:", result.error.issues);
      const fieldErrors: FormErrors = {};
      const firstError = result.error.issues[0];
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof ProductInput;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      setUploadProgress(null);
      // Show toast with first validation error
      toast.error(firstError.message);
      return;
    }
    console.log("✅ [handleSubmit] Validation passed");

    console.log("🔄 [handleSubmit] Starting transition...");
    startTransition(async () => {
      console.log("📦 [handleSubmit] Inside startTransition");
      try {
        // Step 1: Create any new categories first
        const createdCategoryMap = new Map<string, string>(); // tempId -> realId

        if (newCategoryTempIds.length > 0) {
          console.log(
            "🏷️ [handleSubmit] Creating new categories:",
            newCategoryTempIds
          );
          setUploadProgress({
            stage: "saving",
            message: `Creating ${newCategoryTempIds.length} new categor${
              newCategoryTempIds.length > 1 ? "ies" : "y"
            }...`,
          });

          for (const tempId of newCategoryTempIds) {
            const category = availableCategories.find((c) => c.id === tempId);
            if (!category) continue;

            // Create category via server action (slug is auto-generated on backend)
            const { createCategory } = await import(
              "@/lib/supabase/categories"
            );
            const categoryResult = await createCategory(tenantId, {
              name: category.name,
              slug: "", // Auto-generated on the backend
              description: category.description || "",
              imageId: category.imageId || "",
              displayOrder: category.displayOrder,
            });

            if (categoryResult.success && categoryResult.data) {
              createdCategoryMap.set(tempId, categoryResult.data.id);
            } else {
              // Handle category creation failure
              toast.error(
                categoryResult.error?.message ||
                  `Failed to create category "${category.name}"`
              );
              setUploadProgress(null);
              return;
            }
          }
        }

        // Build final category IDs: existing UUIDs + newly created category IDs
        const newlyCreatedIds = Array.from(createdCategoryMap.values());
        const finalCategoryIds = [...existingCategoryIds, ...newlyCreatedIds];
        console.log("✅ [handleSubmit] Final category IDs:", finalCategoryIds);

        // Update formData with all category IDs
        formData.categoryIds = finalCategoryIds;

        // Step 2: Upload images and create/update product
        if (stagedFiles.length > 0) {
          setUploadProgress({
            stage: "uploading",
            message: `Uploading ${stagedFiles.length} image${
              stagedFiles.length > 1 ? "s" : ""
            }...`,
          });
        } else {
          setUploadProgress({
            stage: "saving",
            message: product ? "Saving changes..." : "Creating product...",
          });
        }

        let actionResult;

        console.log("📤 [handleSubmit] Sending to server:", {
          tenantId,
          formData,
          stagedFilesCount: stagedFiles.length,
          isUpdate: !!product,
        });

        if (product) {
          // Update existing product
          console.log("🔄 [handleSubmit] Updating product:", product.id);
          actionResult = await updateProductWithImages(
            tenantId,
            product.id,
            formData,
            stagedFiles
          );
        } else {
          // Create new product
          console.log("➕ [handleSubmit] Creating new product");
          actionResult = await createProductWithImages(
            tenantId,
            formData,
            stagedFiles
          );
        }

        console.log("📥 [handleSubmit] Server response:", actionResult);

        if (!actionResult.success) {
          console.error("❌ [handleSubmit] Product creation failed");
          console.error("❌ [handleSubmit] Full actionResult:", JSON.stringify(actionResult, null, 2));
          console.error("❌ [handleSubmit] Error:", actionResult.error);
          console.error(
            "❌ [handleSubmit] Error message:",
            actionResult.error?.message
          );
          console.error(
            "❌ [handleSubmit] Error field:",
            actionResult.error?.field
          );

          // Rollback: Delete newly created categories if product creation failed
          if (newlyCreatedIds.length > 0) {
            console.warn(
              "⚠️ Product creation failed. Rolling back created categories..."
            );
            const { deleteCategory } = await import(
              "@/lib/supabase/categories"
            );
            for (const categoryId of newlyCreatedIds) {
              await deleteCategory(tenantId, categoryId).catch((err) => {
                console.error("Failed to rollback category:", err);
              });
            }
          }

          if (actionResult.error?.field) {
            setErrors({
              [actionResult.error.field]: actionResult.error.message,
            });
            toast.error(actionResult.error.message);
          } else {
            toast.error(actionResult.error?.message || "Something went wrong");
          }
          setUploadProgress(null);
          return;
        }

        // Get the product ID (from response for new products, or existing)
        const productId = product?.id || actionResult.data?.id;

        // Save variants if enabled
        if (hasVariants && productId) {
          setUploadProgress({
            stage: "saving",
            message: "Saving variants...",
          });

          const activeVariants = variants.filter((v) => !v.isExcluded);
          const validOptions = variantOptions.filter(
            (opt) => opt.name.trim() && opt.values.length > 0
          );

          const variantResult = product
            ? await updateProductVariantsInBulk(tenantId, productId, {
                options: validOptions,
                variants: activeVariants,
              })
            : await createProductVariantsInBulk(tenantId, productId, {
                options: validOptions,
                variants: activeVariants,
              });

          if (!variantResult.success) {
            toast.error(
              variantResult.error?.message || "Failed to save variants"
            );
            // Product was saved but variants failed - still redirect but show warning
            toast.warning(
              "Product saved, but some variants may not have been created"
            );
          }
        }

        // Clean up object URLs for staged images on success
        images.forEach((img) => {
          if (img.isStaged && img.url.startsWith("blob:")) {
            URL.revokeObjectURL(img.url);
          }
        });

        setUploadProgress({ stage: "complete", message: "Success!" });
        toast.success(product ? "Product updated" : "Product created");
        console.log(
          "✅ [handleSubmit] Product saved successfully, navigating..."
        );

        // Small delay to show complete state, then navigate
        setTimeout(() => {
          setUploadProgress(null);
          const targetUrl = `/dashboard/${storeSlug}/products`;
          console.log(`🔄 [handleSubmit] Navigating to: ${targetUrl}`);
          try {
            router.replace(targetUrl);
          } catch (navError) {
            console.error("❌ [handleSubmit] Navigation failed:", navError);
            toast.error(
              "Navigation failed. Please manually return to products page."
            );
          }
        }, 500);
      } catch (error) {
        console.error("❌ [handleSubmit] Product save error:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        console.error("❌ [handleSubmit] Error details:", errorMessage);
        toast.error(`Error: ${errorMessage}`);
        setUploadProgress(null);
      }
    });
  };

  const hasStagedImages = images.some((img) => img.isStaged);

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
          e.preventDefault();
        }
      }}
      className="w-full max-w-full space-y-8"
    >
      <div className="grid w-full max-w-full gap-8 lg:grid-cols-3">
        {/* Main Content - 2 columns */}
        <div className="space-y-8 lg:col-span-2 min-w-0">
          {/* Basic Info */}
          <Card className="overflow-hidden">
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
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter product name"
                  aria-invalid={!!errors.name}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              {/* Note: Product URL slug is auto-generated from the name on the backend */}

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
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Variants */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Variants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>This product has variants</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable if this product comes in different options like size
                    or color
                  </p>
                </div>
                <Switch
                  checked={hasVariants}
                  onCheckedChange={handleHasVariantsChange}
                  disabled={isPending}
                />
              </div>

              {hasVariants && (
                <>
                  <Separator />

                  {/* Variant Options Builder */}
                  <VariantOptionsBuilder
                    options={variantOptions}
                    onChange={handleVariantOptionsChange}
                    existingOptions={existingVariantOptions}
                    error={variantError || undefined}
                    disabled={isPending}
                  />

                  {/* Variant Matrix Table */}
                  {variants.length > 0 && (
                    <>
                      <Separator />
                      <VariantMatrixTable
                        variants={variants}
                        onChange={setVariants}
                        currency={currency}
                        productSlug={name || "product"}
                        disabled={isPending}
                        tenantId={tenantId}
                        trackInventory={trackInventory}
                      />
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - 1 column */}
        <div className="space-y-8">
          {/* Pricing & Category */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing & Category</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0.00"
                  aria-invalid={!!errors.price}
                />
                {hasVariants && (
                  <p className="text-sm text-muted-foreground">
                    Base price (variants can override)
                  </p>
                )}
                {errors.price && (
                  <p className="text-sm text-destructive">{errors.price}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="categories">Categories</Label>
                <Popover
                  open={showCategoryDropdown}
                  onOpenChange={setShowCategoryDropdown}
                >
                  <PopoverAnchor asChild>
                    <div
                      className={cn(
                        "flex min-h-10 w-full flex-wrap items-center gap-2 rounded-md border bg-background p-2",
                        "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                      )}
                      onClick={() => categoryInputRef.current?.focus()}
                    >
                      {/* Selected categories as badges */}
                      {Array.from(selectedCategories).map((categoryId) => {
                        const category = availableCategories.find(
                          (c) => c.id === categoryId
                        );
                        if (!category) return null;

                        return (
                          <Badge
                            key={categoryId}
                            variant="secondary"
                            className="gap-1 pr-1"
                          >
                            {category.name}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCategory(categoryId);
                              }}
                              className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                            >
                              <X className="size-3" />
                              <span className="sr-only">
                                Remove {category.name}
                              </span>
                            </button>
                          </Badge>
                        );
                      })}

                      {/* Input for searching/adding categories */}
                      <input
                        ref={categoryInputRef}
                        type="text"
                        value={categorySearchInput}
                        onChange={(e) => {
                          setCategorySearchInput(e.target.value);
                          // Open dropdown when typing
                          if (!showCategoryDropdown) {
                            setShowCategoryDropdown(true);
                          }
                        }}
                        onFocus={() => {
                          // Always open dropdown on focus if there are categories
                          if (availableCategories.length > 0) {
                            setShowCategoryDropdown(true);
                          }
                        }}
                        onBlur={(e) => {
                          // Close dropdown when focus leaves the input
                          // Use a small delay to allow click events on dropdown items to fire first
                          const target = e.relatedTarget;
                          if (!target || !target.closest('[role="dialog"]')) {
                            setTimeout(() => {
                              setShowCategoryDropdown(false);
                            }, 150);
                          }
                        }}
                        onKeyDown={handleCategoryKeyDown}
                        placeholder={
                          selectedCategories.size === 0
                            ? "Type to search or add categories..."
                            : "Add more..."
                        }
                        className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                  </PopoverAnchor>
                  <PopoverContent
                    className="w-(--radix-popover-trigger-width) p-0"
                    align="start"
                    side="bottom"
                    sideOffset={4}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <Command>
                      <CommandList>
                        <CommandEmpty>
                          <div className="p-2 text-sm">
                            <p className="text-muted-foreground">
                              No matching categories.
                            </p>
                            {categorySearchInput.trim() && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="mt-2 w-full justify-start"
                                onClick={handleCreateNewCategory}
                              >
                                <Plus className="mr-2 size-4" />
                                Create &quot;{categorySearchInput.trim()}&quot;
                              </Button>
                            )}
                          </div>
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredCategories.map((category) => (
                            <CommandItem
                              key={category.id}
                              value={category.name}
                              onSelect={() => handleSelectCategory(category.id)}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    "flex size-4 items-center justify-center rounded-sm border",
                                    selectedCategories.has(category.id)
                                      ? "bg-primary border-primary"
                                      : "border-input"
                                  )}
                                >
                                  {selectedCategories.has(category.id) && (
                                    <Check className="size-3 text-primary-foreground" />
                                  )}
                                </div>
                                <span>{category.name}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-sm text-muted-foreground">
                  Click to browse categories, type to search or create new ones.
                  Press Backspace to remove.
                </p>
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
                    {hasVariants
                      ? "Enable stock tracking for variants (stock is tracked per variant)"
                      : "Enable stock tracking for this product"}
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
                  <div className="grid gap-4">
                    {!hasVariants && (
                      <div className="space-y-2">
                        <Label htmlFor="stock">Stock Quantity</Label>
                        <Input
                          id="stock"
                          type="number"
                          min="0"
                          value={stock}
                          onChange={(e) => setStock(e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="0"
                        />
                      </div>
                    )}
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
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder="5"
                      />
                      <p className="text-sm text-muted-foreground">
                        {hasVariants
                          ? "Alert when total variant stock falls below this number"
                          : "Alert when stock falls below this number"}
                      </p>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Backorders</Label>
                  <p className="text-sm text-muted-foreground">
                    {hasVariants
                      ? "Allow orders when variant is out of stock"
                      : "Allow orders when out of stock"}
                  </p>
                </div>
                <Switch
                  checked={allowBackorder}
                  onCheckedChange={setAllowBackorder}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Stock on Storefront</Label>
                  <p className="text-sm text-muted-foreground">
                    Display stock quantity to customers
                  </p>
                </div>
                <Switch checked={showStock} onCheckedChange={setShowStock} />
              </div>
            </CardContent>
          </Card>

          {/* Shipping */}
          <Card>
            <CardHeader>
              <CardTitle>Shipping</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.001"
                  min="0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0.000"
                />
                <p className="text-sm text-muted-foreground">
                  Product weight for shipping
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Dimensions (cm)</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label
                      htmlFor="length"
                      className="text-xs text-muted-foreground"
                    >
                      Length
                    </Label>
                    <Input
                      id="length"
                      type="number"
                      step="0.01"
                      min="0"
                      value={length}
                      onChange={(e) => setLength(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="width"
                      className="text-xs text-muted-foreground"
                    >
                      Width
                    </Label>
                    <Input
                      id="width"
                      type="number"
                      step="0.01"
                      min="0"
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="height"
                      className="text-xs text-muted-foreground"
                    >
                      Height
                    </Label>
                    <Input
                      id="height"
                      type="number"
                      step="0.01"
                      min="0"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/dashboard/${storeSlug}/products`)}
          disabled={isPending || uploadProgress !== null}
        >
          Cancel
        </Button>
        <div className="flex gap-3">
          <Button
            type="submit"
            variant="outline"
            disabled={isPending || uploadProgress !== null}
            onClick={(e) => {
              e.preventDefault();
              // Capture form reference before async operation
              const form = e.currentTarget.closest("form");
              setIsActive(false);
              // Trigger form submission after state update
              setTimeout(() => {
                form?.requestSubmit();
              }, 0);
            }}
          >
            {isPending || uploadProgress ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving draft...
              </>
            ) : (
              "Save Draft"
            )}
          </Button>
          <Button
            type="submit"
            disabled={isPending || uploadProgress !== null}
            onClick={(e) => {
              console.log("🖱️ [Publish Button] Clicked");
              e.preventDefault();
              // Capture form reference before async operation
              const form = e.currentTarget.closest("form");
              console.log("📝 [Publish Button] Form element:", form);
              setIsActive(true);
              // Trigger form submission after state update
              setTimeout(() => {
                console.log("⏰ [Publish Button] Calling requestSubmit");
                form?.requestSubmit();
              }, 0);
            }}
          >
            {isPending || uploadProgress ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {uploadProgress?.message ||
                  (hasStagedImages ? "Publishing..." : "Publishing...")}
              </>
            ) : (
              "Publish"
            )}
          </Button>
        </div>
      </div>

      {/* Media Selector Dialog */}
      <EnhancedMediaPicker
        tenantId={tenantId}
        open={mediaSelectorOpen}
        onOpenChange={setMediaSelectorOpen}
        onSelect={handleMediaSelect}
        multiple
        selectedIds={images.filter((img) => !img.isStaged).map((img) => img.id)}
        title="Select Product Images"
      />

      {/* Disable Variants Confirmation Dialog */}
      <AlertDialog
        open={showDisableVariantsDialog}
        onOpenChange={setShowDisableVariantsDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove all variants?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all variant options and {variants.length} variant
              {variants.length !== 1 ? "s" : ""} you have configured. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep variants</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDisableVariants}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove variants
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
