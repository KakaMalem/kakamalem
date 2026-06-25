"use client";

import {
  useState,
  useTransition,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Reorder, useDragControls } from "framer-motion";
import {
  Upload,
  X,
  Trash2,
  Loader2,
  ImageIcon,
  GripVertical,
  Plus,
  Check,
  Eye,
  Wand2,
  Barcode,
  Camera,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import {
  UnifiedMediaSelector,
  type MediaSelection,
} from "@/components/dashboard/media/unified-media-selector";
import { useImagePreview } from "@/components/ui/image-preview";
import { VariantMatrixTable } from "@/components/dashboard/products/variant-matrix-table";
import { VariantWizard } from "@/components/dashboard/variants/variant-wizard";
import {
  OptionValueImageManager,
  type OptionValueImageAssignment,
} from "@/components/dashboard/variants/option-value-image-manager";
import {
  PriceTiersEditor,
  type PriceTierInput,
} from "@/components/dashboard/products/price-tiers-editor";
import { BarcodeScanner } from "@/components/dashboard/pos/barcode-scanner";

import type { Category, Product, Media, PriceTier } from "@/lib/db/schema";
import { productSchema, type ProductInput } from "@/lib/validations/products";
import type {
  InlineOption,
  GeneratedVariant,
} from "@/lib/validations/variant-form";
import {
  createProductWithImages,
  updateProductWithImages,
} from "@/lib/actions/products";
import {
  createProductVariantsInBulk,
  updateProductVariantsInBulk,
} from "@/lib/actions/variants";
import { savePriceTiers } from "@/lib/actions/price-tiers";
import { useBarcodeScanner } from "@/lib/hooks/use-barcode-scanner";
import { cn } from "@/lib/utils";
import { requestSubmit } from "@/lib/utils/request-submit";
import { handleFormErrors } from "@/lib/utils/form-errors";
import {
  generateVariantCombinations,
  validateVariantCount,
} from "@/lib/variants/cartesian";
import {
  MAX_FILES,
  MAX_SIZES,
  formatFileSize,
  UPLOAD_ERROR_MESSAGES,
} from "@/lib/config/file-validation";
import { createMediaRecord } from "@/lib/actions/media";

// Upload state for tracking progress
interface UploadingImage {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "complete" | "error";
  error?: string;
}

interface ProductFormProps {
  tenantId: string;
  storeSlug: string;
  categories: Category[];
  currency: string;
  product?: Product & {
    images?: { media: Media; position: number }[];
    productCategories?: { categoryId: string }[];
  };
  /** Initial variant options if editing a product with variants */
  initialVariantOptions?: InlineOption[];
  /** Initial variants if editing a product with variants */
  initialVariants?: GeneratedVariant[];
  /** Initial price tiers if editing a product */
  initialPriceTiers?: PriceTier[];
  /** Initial option value image assignments if editing a product */
  initialImageAssignments?: OptionValueImageAssignment[];
  /** POS scanner mode - 'camera' shows scan button, 'usb' uses keyboard input */
  posScannerMode?: "camera" | "usb";
}

type FormErrors = Partial<Record<keyof ProductInput, string>>;

// Map field names to their DOM element IDs for scroll-to-error
const FIELD_ID_MAP: Record<string, string> = {
  name: "name",
  price: "price",
  compareAtPrice: "compareAtPrice",
  costPrice: "costPrice",
  description: "description",
  stock: "stock",
  lowStockThreshold: "lowStockThreshold",
  weight: "weight",
  length: "length",
  width: "width",
  height: "height",
  minOrderQuantity: "minOrderQuantity",
  maxOrderQuantity: "maxOrderQuantity",
};

// Image can be either an existing media item or a staged file
type ImageItem = {
  id: string; // For existing: media ID. For staged: temp ID
  url: string; // For existing: media URL. For staged: object URL
  altText?: string | null;
  file?: File; // Only for staged uploads
  isStaged?: boolean; // True for new uploads not yet saved
  fileSize?: number; // File size in bytes
  fileName?: string; // File name
  width?: number; // Image width in pixels
  height?: number; // Image height in pixels
};

// Draggable image item component
function DraggableImageItem({
  image,
  index,
  onRemove,
  onPreview,
}: {
  image: ImageItem;
  index: number;
  onRemove: (id: string) => void;
  onPreview: () => void;
}) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={image}
      dragListener={false}
      dragControls={dragControls}
      className="group flex items-center gap-3 p-2 rounded-lg border bg-muted select-none"
      style={{ position: "relative" }}
      whileDrag={{ zIndex: 50 }}
    >
      {/* Drag Handle */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="cursor-grab active:cursor-grabbing shrink-0 touch-none p-1 -m-1"
      >
        <GripVertical className="size-5 text-muted-foreground" />
      </div>
      <button
        type="button"
        onClick={onPreview}
        className="relative size-16 rounded overflow-hidden shrink-0 border cursor-zoom-in"
        title="Preview image"
      >
        <Image
          src={image.url}
          alt={image.altText || image.fileName || `Product image ${index + 1}`}
          fill
          className="object-cover pointer-events-none"
          unoptimized={image.isStaged}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors">
          <Eye className="size-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">
            {image.fileName || `Image ${index + 1}`}
          </p>
          {index === 0 && (
            <span className="inline-block rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground shrink-0">
              Main
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {image.fileSize ? formatFileSize(image.fileSize) : "Unknown size"}
          {image.width && image.height
            ? ` • ${image.width}×${image.height}`
            : ""}
        </p>
      </div>
      {/* Delete button */}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onRemove(image.id)}
        title="Remove"
        className="shrink-0 cursor-pointer"
      >
        <Trash2 className="size-4 text-muted-foreground group-hover:text-destructive" />
      </Button>
    </Reorder.Item>
  );
}

export function ProductForm({
  tenantId,
  storeSlug,
  categories,
  currency,
  product,
  initialVariantOptions = [],
  initialVariants = [],
  initialPriceTiers = [],
  initialImageAssignments = [],
  posScannerMode = "usb",
}: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FormErrors>({});
  const { openPreview } = useImagePreview();

  // Scroll to first error field when errors change
  useEffect(() => {
    const errorFields = Object.keys(errors);
    if (errorFields.length === 0) return;

    const firstErrorField = errorFields[0];
    const elementId = FIELD_ID_MAP[firstErrorField];

    if (elementId) {
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        // Focus the element after scrolling
        setTimeout(() => {
          element.focus();
        }, 300);
      }
    }
  }, [errors]);

  // Ref for variant section to scroll to on variant errors
  const variantSectionRef = useRef<HTMLDivElement>(null);

  // Scroll to variant section helper
  const scrollToVariantSection = useCallback(() => {
    if (variantSectionRef.current) {
      variantSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, []);
  const [mediaSelectorOpen, setMediaSelectorOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    stage: "validating" | "uploading" | "saving" | "complete";
    message: string;
  } | null>(null);

  // Form state
  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  // Note: slug is now auto-generated on the backend, no need to manage it here
  const [price, setPrice] = useState(product?.price || "");
  const [compareAtPrice, setCompareAtPrice] = useState(
    (product as unknown as { compareAtPrice?: string })?.compareAtPrice || ""
  );
  const [costPrice, setCostPrice] = useState(
    (product as unknown as { costPrice?: string })?.costPrice || ""
  );
  const [minOrderQuantity, setMinOrderQuantity] = useState(
    String(
      (product as unknown as { minOrderQuantity?: number })?.minOrderQuantity ??
        ""
    )
  );
  const [maxOrderQuantity, setMaxOrderQuantity] = useState(
    String(
      (product as unknown as { maxOrderQuantity?: number })?.maxOrderQuantity ??
        ""
    )
  );
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
  const [barcode, setBarcode] = useState(product?.barcode || "");
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [weight, setWeight] = useState(product?.weight || "");
  const [length, setLength] = useState(product?.length || "");
  const [width, setWidth] = useState(product?.width || "");
  const [height, setHeight] = useState(product?.height || "");
  const [status, setStatus] = useState<"draft" | "active" | "archived">(
    product?.status ?? "draft"
  );

  // Channel visibility
  const [showOnStorefront, setShowOnStorefront] = useState(
    product?.showOnStorefront ?? true
  );
  const [showOnPos, setShowOnPos] = useState(product?.showOnPos ?? true);

  // Variant state
  const [hasVariants, setHasVariants] = useState(product?.hasVariants ?? false);

  // USB Barcode scanner - listens globally for rapid keystrokes
  // Only enabled for simple products (not variants) when using USB scanner mode
  useBarcodeScanner({
    onScan: (scannedBarcode) => {
      setBarcode(scannedBarcode);
      toast.success(`Barcode scanned: ${scannedBarcode}`);
    },
    enabled: posScannerMode === "usb" && !hasVariants,
    minLength: 4,
  });
  const [variantOptions, setVariantOptions] = useState<InlineOption[]>(
    initialVariantOptions
  );
  const [variants, setVariants] = useState<GeneratedVariant[]>(initialVariants);
  const [showDisableVariantsDialog, setShowDisableVariantsDialog] =
    useState(false);
  const [showVariantWizard, setShowVariantWizard] = useState(false);
  const [imageAssignments, setImageAssignments] = useState<
    OptionValueImageAssignment[]
  >(initialImageAssignments);

  // Price tiers state
  const [priceTiers, setPriceTiers] = useState<PriceTierInput[]>(
    initialPriceTiers.map((tier) => ({
      id: tier.id,
      minQuantity: tier.minQuantity,
      maxQuantity: tier.maxQuantity,
      price: tier.price,
    }))
  );

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
      fileSize: img.media.fileSize ?? undefined,
      fileName: img.media.fileName ?? undefined,
      width: img.media.width ?? undefined,
      height: img.media.height ?? undefined,
    })) || []
  );

  // Track uploads in progress
  const [uploadingImages, setUploadingImages] = useState<UploadingImage[]>([]);

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
      // Always prevent default Enter behavior to avoid mobile keyboard moving to next field
      e.preventDefault();
      e.stopPropagation();

      // If there's text in the input, create the category
      if (categorySearchInput.trim()) {
        handleCreateNewCategory();
        return;
      }

      // If dropdown is open and there are filtered categories, select the first one
      if (showCategoryDropdown && filteredCategories.length > 0) {
        handleSelectCategory(filteredCategories[0].id);
        return;
      }

      // Otherwise just close the dropdown and blur (do nothing else)
      setShowCategoryDropdown(false);
      categoryInputRef.current?.blur();
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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

  // Upload a single file with progress tracking
  const uploadSingleFile = useCallback(
    async (file: File, uploadId: string): Promise<ImageItem | null> => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tenantId", tenantId);
      formData.append("folder", "products");

      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploadingImages((prev) =>
              prev.map((u) => (u.id === uploadId ? { ...u, progress } : u))
            );
          }
        });

        xhr.addEventListener("load", async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText) as {
                success: boolean;
                file?: {
                  url: string;
                  filename: string;
                  originalName: string;
                  size: number;
                  mimeType: string;
                  width?: number;
                  height?: number;
                };
                error?: string;
              };

              if (response.success && response.file) {
                // Create media record in database
                const mediaResult = await createMediaRecord(tenantId, {
                  url: response.file.url,
                  fileName: response.file.originalName,
                  fileSize: response.file.size,
                  mimeType: response.file.mimeType,
                  width: response.file.width,
                  height: response.file.height,
                });

                if (mediaResult.success && mediaResult.data) {
                  setUploadingImages((prev) =>
                    prev.map((u) =>
                      u.id === uploadId
                        ? { ...u, progress: 100, status: "complete" as const }
                        : u
                    )
                  );

                  resolve({
                    id: mediaResult.data.id,
                    url: mediaResult.data.url,
                    altText: null,
                    isStaged: false,
                    fileSize: response.file.size,
                    fileName: response.file.originalName,
                    width: response.file.width,
                    height: response.file.height,
                  });
                } else {
                  setUploadingImages((prev) =>
                    prev.map((u) =>
                      u.id === uploadId
                        ? {
                            ...u,
                            status: "error" as const,
                            error: "Failed to save media record",
                          }
                        : u
                    )
                  );
                  resolve(null);
                }
              } else {
                setUploadingImages((prev) =>
                  prev.map((u) =>
                    u.id === uploadId
                      ? {
                          ...u,
                          status: "error" as const,
                          error: response.error || "Upload failed",
                        }
                      : u
                  )
                );
                resolve(null);
              }
            } catch {
              setUploadingImages((prev) =>
                prev.map((u) =>
                  u.id === uploadId
                    ? { ...u, status: "error" as const, error: "Server error" }
                    : u
                )
              );
              resolve(null);
            }
          } else {
            let error = "Upload failed";
            if (xhr.status === 413) {
              error = UPLOAD_ERROR_MESSAGES.fileTooLarge(
                formatFileSize(MAX_SIZES.products)
              );
            } else if (xhr.status === 415) {
              error = UPLOAD_ERROR_MESSAGES.invalidType;
            }
            setUploadingImages((prev) =>
              prev.map((u) =>
                u.id === uploadId
                  ? { ...u, status: "error" as const, error }
                  : u
              )
            );
            resolve(null);
          }
        });

        xhr.addEventListener("error", () => {
          setUploadingImages((prev) =>
            prev.map((u) =>
              u.id === uploadId
                ? {
                    ...u,
                    status: "error" as const,
                    error: UPLOAD_ERROR_MESSAGES.networkError,
                  }
                : u
            )
          );
          resolve(null);
        });

        xhr.timeout = 120000; // 2 minute timeout
        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });
    },
    [tenantId]
  );

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const maxSize = MAX_SIZES.products;
    const maxFiles = MAX_FILES.productImages;

    // Check max files limit
    if (fileArray.length > maxFiles) {
      toast.error(UPLOAD_ERROR_MESSAGES.tooManyFiles(maxFiles));
      e.target.value = "";
      return;
    }

    // Validate files first
    const validFiles: { file: File; uploadId: string }[] = [];

    for (const file of fileArray) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name}: ${UPLOAD_ERROR_MESSAGES.invalidType}`);
        continue;
      }
      // Validate file size
      if (file.size > maxSize) {
        toast.error(
          `${file.name}: ${UPLOAD_ERROR_MESSAGES.fileTooLarge(
            formatFileSize(maxSize)
          )}`
        );
        continue;
      }

      const uploadId = `upload-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 11)}`;
      validFiles.push({ file, uploadId });
    }

    if (validFiles.length === 0) {
      e.target.value = "";
      return;
    }

    // Add to uploading state
    setUploadingImages((prev) => [
      ...prev,
      ...validFiles.map(({ file, uploadId }) => ({
        id: uploadId,
        file,
        progress: 0,
        status: "uploading" as const,
      })),
    ]);

    // Reset input
    e.target.value = "";

    // Upload files (up to 3 concurrently)
    const results: ImageItem[] = [];
    const concurrency = 3;

    for (let i = 0; i < validFiles.length; i += concurrency) {
      const batch = validFiles.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(({ file, uploadId }) => uploadSingleFile(file, uploadId))
      );
      results.push(...batchResults.filter((r): r is ImageItem => r !== null));
    }

    // Add successfully uploaded images to the images state
    if (results.length > 0) {
      setImages((prev) => [...prev, ...results]);
      toast.success(
        `${results.length} image${results.length > 1 ? "s" : ""} uploaded`
      );
    }

    // Clear completed uploads after a delay
    setTimeout(() => {
      setUploadingImages((prev) => prev.filter((u) => u.status !== "complete"));
    }, 2000);
  };

  const removeImage = (imageId: string) => {
    setImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  const handleMediaSelect = (media: MediaSelection[]) => {
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
        altText: m.altText,
        isStaged: false, // Existing media, not staged
        fileSize: m.fileSize ?? undefined,
        fileName: m.fileName ?? undefined,
        width: m.width ?? undefined,
        height: m.height ?? undefined,
      })),
    ]);

    if (newImages.length > 0) {
      toast.success(
        `${newImages.length} image${newImages.length !== 1 ? "s" : ""} added`
      );
    }
  };

  // Handle variant options change - regenerate variants
  const handleVariantOptionsChange = useCallback(
    (newOptions: InlineOption[]) => {
      setVariantOptions(newOptions);

      // Check if all options have at least one value
      const validOptions = newOptions.filter(
        (opt) => opt.name.trim() && opt.values.length > 0
      );

      if (validOptions.length === 0) {
        setVariants([]);
        setHasVariants(false); // No options = simple product
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
        toast.error(validation.message);
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
        // SKU is auto-generated on the backend
        return {
          tempId: combo.tempId,
          optionValues: combo.optionValues,
          displayName: combo.displayName,
          barcode: "", // Barcode can be scanned or entered manually
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
    [variants]
  );

  // Confirm disabling variants (used by confirmation dialog)
  const confirmDisableVariants = useCallback(() => {
    setHasVariants(false);
    setVariantOptions([]);
    setVariants([]);
    setShowDisableVariantsDialog(false);
  }, []);

  // Check if uploads are in progress
  const isUploading = uploadingImages.some((u) => u.status === "uploading");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
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
        toast.error(errorMsg);
        scrollToVariantSection();
        setUploadProgress(null);
        return;
      }

      // Must have at least one non-excluded variant
      const activeVariants = variants.filter((v) => !v.isExcluded);
      if (activeVariants.length === 0) {
        const errorMsg = "Please include at least one variant";
        toast.error(errorMsg);
        scrollToVariantSection();
        setUploadProgress(null);
        return;
      }

      // Check variant count limit
      const validation = validateVariantCount(activeVariants.length);
      if (validation.status === "error") {
        toast.error(validation.message);
        scrollToVariantSection();
        setUploadProgress(null);
        return;
      }
    }

    // Get all image IDs (images are now uploaded immediately, no staged files)
    const imageIds = images.map((img) => img.id);

    // Separate existing category IDs (UUIDs) from new category temp IDs
    // New categories will be created before product submission
    const existingCategoryIds = Array.from(selectedCategories).filter(
      (id) => !id.startsWith("temp-")
    );
    const newCategoryTempIds = Array.from(selectedCategories).filter((id) =>
      id.startsWith("temp-")
    );

    const formData: ProductInput = {
      name,
      slug: "", // Auto-generated on the backend, empty string for validation
      description,
      price,
      compareAtPrice,
      costPrice,
      minOrderQuantity,
      maxOrderQuantity,
      // Only include existing (valid UUID) category IDs for initial validation
      // New categories will be created first, then their real IDs will be added
      categoryIds: existingCategoryIds,
      trackInventory, // Can be enabled/disabled for both simple and variant products
      stock: hasVariants ? "0" : stock,
      allowBackorder,
      lowStockThreshold,
      showStock,
      barcode: hasVariants ? "" : barcode, // Only for simple products
      weight,
      length,
      width,
      height,
      status,
      showOnStorefront,
      showOnPos,
      displayOrder: String(product?.displayOrder ?? 0),
      imageIds, // All images are already uploaded
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
      setUploadProgress(null);
      // Show smart toast with all validation errors and scroll to first
      handleFormErrors(fieldErrors, FIELD_ID_MAP);
      return;
    }

    startTransition(async () => {
      try {
        // Step 1: Create any new categories first
        const createdCategoryMap = new Map<string, string>(); // tempId -> realId

        if (newCategoryTempIds.length > 0) {
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
            const { createCategory } = await import("@/lib/actions/categories");
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

        // Update formData with all category IDs
        formData.categoryIds = finalCategoryIds;

        // Step 2: Create/update product (images are already uploaded)
        setUploadProgress({
          stage: "saving",
          message: product ? "Saving changes..." : "Creating product...",
        });

        let actionResult;

        if (product) {
          // Update existing product
          actionResult = await updateProductWithImages(
            tenantId,
            product.id,
            formData,
            [] // No staged files - images are uploaded immediately
          );
        } else {
          // Create new product
          actionResult = await createProductWithImages(
            tenantId,
            formData,
            [] // No staged files - images are uploaded immediately
          );
        }

        if (!actionResult.success) {
          // Rollback: Delete newly created categories if product creation failed
          if (newlyCreatedIds.length > 0) {
            const { deleteCategory } = await import("@/lib/actions/categories");
            for (const categoryId of newlyCreatedIds) {
              await deleteCategory(tenantId, categoryId).catch(() => {
                // Silently handle rollback failures
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
                imageAssignments,
              })
            : await createProductVariantsInBulk(tenantId, productId, {
                options: validOptions,
                variants: activeVariants,
                imageAssignments,
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

        // Remove variants if they were disabled (product had variants but now doesn't)
        if (!hasVariants && product?.hasVariants && productId) {
          setUploadProgress({
            stage: "saving",
            message: "Removing variants...",
          });

          const removeResult = await updateProductVariantsInBulk(
            tenantId,
            productId,
            {
              options: [],
              variants: [],
              imageAssignments: [],
            }
          );

          if (!removeResult.success) {
            toast.error(
              removeResult.error?.message || "Failed to remove variants"
            );
          }
        }

        // Save price tiers if any exist
        if (productId && priceTiers.length > 0) {
          setUploadProgress({
            stage: "saving",
            message: "Saving price tiers...",
          });

          const priceTiersResult = await savePriceTiers(
            productId,
            tenantId,
            priceTiers
          );

          if (!priceTiersResult.success) {
            toast.error(
              priceTiersResult.error?.message || "Failed to save price tiers"
            );
            toast.warning(
              "Product saved, but price tiers may not have been created"
            );
          }
        } else if (productId && priceTiers.length === 0 && product) {
          // If editing and all tiers were removed, clear them
          const priceTiersResult = await savePriceTiers(
            productId,
            tenantId,
            []
          );

          if (!priceTiersResult.success) {
            toast.warning("Failed to clear price tiers");
          }
        }

        setUploadProgress({ stage: "complete", message: "Success!" });
        toast.success(product ? "Product updated" : "Product created");

        // Small delay to show complete state, then navigate
        setTimeout(() => {
          setUploadProgress(null);
          router.replace(`/dashboard/${storeSlug}/products`);
        }, 500);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        toast.error(`Error: ${errorMessage}`);
        setUploadProgress(null);
      }
    });
  };

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
        {/* Main Content - 2 columns on desktop */}
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
                <RichTextEditor
                  id="description"
                  value={description}
                  onChange={setDescription}
                  placeholder="Describe your product..."
                  minHeight="120px"
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
                {/* Image List */}
                {images.length > 0 && (
                  <Reorder.Group
                    axis="y"
                    values={images}
                    onReorder={setImages}
                    className="space-y-2"
                  >
                    {images.map((image, index) => (
                      <DraggableImageItem
                        key={image.id}
                        image={image}
                        index={index}
                        onRemove={removeImage}
                        onPreview={() => {
                          const previewImages = images.map((img) => ({
                            src: img.url,
                            alt: img.altText || img.fileName || "Product image",
                          }));
                          openPreview(previewImages, index);
                        }}
                      />
                    ))}
                  </Reorder.Group>
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
                <p className="text-xs text-muted-foreground/80">
                  Recommended: 1000×1000px minimum, square (1:1) format for best
                  display
                </p>

                {/* Upload Progress */}
                {uploadingImages.length > 0 && (
                  <div className="space-y-2 mt-4">
                    {uploadingImages.map((upload) => (
                      <div
                        key={upload.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-lg border bg-muted",
                          upload.status === "error" &&
                            "border-destructive/50 bg-destructive/5",
                          upload.status === "complete" &&
                            "border-green-500/50 bg-green-50"
                        )}
                      >
                        <div className="shrink-0">
                          {upload.status === "uploading" && (
                            <Loader2 className="size-5 text-primary animate-spin" />
                          )}
                          {upload.status === "complete" && (
                            <Check className="size-5 text-green-600" />
                          )}
                          {upload.status === "error" && (
                            <X className="size-5 text-destructive" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {upload.file.name}
                          </p>
                          {upload.status === "uploading" && (
                            <Progress
                              value={upload.progress}
                              className="mt-1 h-1.5"
                            />
                          )}
                          {upload.status === "error" && upload.error && (
                            <p className="text-xs text-destructive truncate">
                              {upload.error}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-xs text-muted-foreground">
                          {upload.status === "uploading" &&
                            `${upload.progress}%`}
                          {upload.status === "complete" && "Done"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pricing - Essential business field, high priority */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="price">
                    Price ({currency}){" "}
                    <span className="text-destructive">*</span>
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
                  <Label htmlFor="compareAtPrice">
                    Compare-at Price ({currency})
                  </Label>
                  <Input
                    id="compareAtPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={compareAtPrice}
                    onChange={(e) => setCompareAtPrice(e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="0.00"
                    aria-invalid={!!errors.compareAtPrice}
                  />
                  <p className="text-sm text-muted-foreground">
                    Original price (strikethrough)
                  </p>
                  {errors.compareAtPrice && (
                    <p className="text-sm text-destructive">
                      {errors.compareAtPrice}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="costPrice">Cost Price ({currency})</Label>
                <Input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0.00"
                  aria-invalid={!!errors.costPrice}
                />
                <p className="text-sm text-muted-foreground">
                  Your cost for profit tracking (not shown to customers)
                </p>
                {errors.costPrice && (
                  <p className="text-sm text-destructive">{errors.costPrice}</p>
                )}
              </div>

              {/* Profit Margin Display */}
              {price &&
                costPrice &&
                parseFloat(price) > 0 &&
                parseFloat(costPrice) > 0 && (
                  <div className="rounded-md bg-muted/50 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Profit Margin
                      </span>
                      <span className="font-medium">
                        {Math.round(
                          ((parseFloat(price) - parseFloat(costPrice)) /
                            parseFloat(price)) *
                            100
                        )}
                        %
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-muted-foreground">
                        Profit per Unit
                      </span>
                      <span className="font-medium">
                        {currency}{" "}
                        {(parseFloat(price) - parseFloat(costPrice)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Organization - Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                        type="search"
                        inputMode="search"
                        enterKeyHint="done"
                        autoComplete="off"
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
                        className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
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
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Variants */}
          <Card ref={variantSectionRef} className="overflow-hidden">
            <CardHeader>
              <CardTitle>Variants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 overflow-hidden">
              {!hasVariants ? (
                /* No variants yet - show wizard button */
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    Add variants if this product comes in different options like
                    size, color, or material
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setHasVariants(true);
                      setShowVariantWizard(true);
                    }}
                    disabled={isPending}
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    Add Variants
                  </Button>
                </div>
              ) : (
                <>
                  {/* Wizard Button for existing variants */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">
                        Variant Options
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Configure size, color, material and other options
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDisableVariantsDialog(true)}
                        disabled={isPending}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove Variants
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowVariantWizard(true)}
                        disabled={isPending}
                      >
                        <Wand2 className="h-4 w-4 mr-2" />
                        Open Wizard
                      </Button>
                    </div>
                  </div>

                  {/* Global Inventory Settings for Variants */}
                  {variants.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium">
                          Inventory Settings
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          These settings apply to all variants
                        </p>

                        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label>Track Inventory</Label>
                              <p className="text-sm text-muted-foreground">
                                Enable stock tracking for variants
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
                              <div className="space-y-2">
                                <Label htmlFor="lowStockThreshold-variants">
                                  Low Stock Threshold
                                </Label>
                                <Input
                                  id="lowStockThreshold-variants"
                                  type="number"
                                  min="0"
                                  value={lowStockThreshold}
                                  onChange={(e) =>
                                    setLowStockThreshold(e.target.value)
                                  }
                                  onWheel={(e) => e.currentTarget.blur()}
                                  placeholder="5"
                                />
                                <p className="text-sm text-muted-foreground">
                                  Alert when variant stock falls below this
                                  number
                                </p>
                              </div>

                              <Separator />

                              <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <Label>Allow Backorders</Label>
                                  <p className="text-sm text-muted-foreground">
                                    Allow orders when variant is out of stock
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
                                <Switch
                                  checked={showStock}
                                  onCheckedChange={setShowStock}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Variant Matrix Table */}
                      <Separator />
                      <VariantMatrixTable
                        variants={variants}
                        onChange={setVariants}
                        currency={currency}
                        productSlug={name || "product"}
                        disabled={isPending}
                        trackInventory={trackInventory}
                        scannerMode={posScannerMode}
                      />

                      {/* Option Value Image Mapping */}
                      {images.length > 0 && variantOptions.length > 0 && (
                        <>
                          <Separator />
                          <OptionValueImageManager
                            options={variantOptions}
                            productImages={images.map((img) => ({
                              id: img.id,
                              mediaId: img.id,
                              url: img.url,
                              altText: img.altText,
                              position: 0,
                            }))}
                            assignments={imageAssignments}
                            onAssignmentsChange={setImageAssignments}
                          />
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Inventory - for simple products without variants */}
          {!hasVariants && (
            <Card>
              <CardHeader>
                <CardTitle>Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Barcode */}
                <div className="space-y-2">
                  <Label htmlFor="barcode" className="flex items-center gap-2">
                    <Barcode className="size-4" />
                    Barcode
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="barcode"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder={
                        posScannerMode === "camera"
                          ? "Tap camera to scan"
                          : "Scan with USB scanner or enter manually"
                      }
                      maxLength={50}
                      className="flex-1"
                    />
                    {posScannerMode === "camera" && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setBarcodeScannerOpen(true)}
                        >
                          <Camera className="size-4" />
                        </Button>
                        <BarcodeScanner
                          open={barcodeScannerOpen}
                          onOpenChange={setBarcodeScannerOpen}
                          onScan={(scannedBarcode) => {
                            setBarcode(scannedBarcode);
                            toast.success(`Barcode scanned: ${scannedBarcode}`);
                          }}
                        />
                      </>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {posScannerMode === "camera"
                      ? "Tap the camera button to scan, or enter manually"
                      : "Use your USB/Bluetooth scanner, or enter manually"}
                  </p>
                </div>

                <Separator />

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
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lowStockThreshold">
                          Low Stock Alert
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
                      </div>
                    </div>

                    <Separator />

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

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Show Stock on Storefront</Label>
                        <p className="text-sm text-muted-foreground">
                          Display stock quantity to customers
                        </p>
                      </div>
                      <Switch
                        checked={showStock}
                        onCheckedChange={setShowStock}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

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
                  Product weight for shipping calculations
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

        {/* Sidebar - Advanced Options (1 column) */}
        <div className="space-y-8">
          {/* Sales Channels */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Channels</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Online Store</Label>
                  <p className="text-sm text-muted-foreground">
                    Show on storefront
                  </p>
                </div>
                <Switch
                  checked={showOnStorefront}
                  onCheckedChange={setShowOnStorefront}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Point of Sale</Label>
                  <p className="text-sm text-muted-foreground">
                    Show in POS terminal
                  </p>
                </div>
                <Switch checked={showOnPos} onCheckedChange={setShowOnPos} />
              </div>
            </CardContent>
          </Card>

          {/* Order Limits */}
          <Card>
            <CardHeader>
              <CardTitle>Order Limits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="minOrderQuantity">Min Qty</Label>
                  <Input
                    id="minOrderQuantity"
                    type="number"
                    min="1"
                    value={minOrderQuantity}
                    onChange={(e) => setMinOrderQuantity(e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxOrderQuantity">Max Qty</Label>
                  <Input
                    id="maxOrderQuantity"
                    type="number"
                    min="1"
                    value={maxOrderQuantity}
                    onChange={(e) => setMaxOrderQuantity(e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="No limit"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Limit how many units a customer can order
              </p>
            </CardContent>
          </Card>

          {/* Bulk Pricing (Price Tiers) */}
          <PriceTiersEditor
            tiers={priceTiers}
            onChange={setPriceTiers}
            basePrice={price}
            currency={currency}
            disabled={isPending}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/dashboard/${storeSlug}/products`)}
          disabled={isPending || uploadProgress !== null || isUploading}
        >
          Cancel
        </Button>
        <div className="flex gap-3">
          <Button
            type="submit"
            variant="outline"
            disabled={isPending || uploadProgress !== null || isUploading}
            onClick={(e) => {
              e.preventDefault();
              const form = e.currentTarget.closest("form");
              setStatus("draft");
              setTimeout(() => {
                requestSubmit(form);
              }, 0);
            }}
          >
            {(isPending || uploadProgress) && status === "draft" ? (
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
            disabled={isPending || uploadProgress !== null || isUploading}
            onClick={(e) => {
              e.preventDefault();
              const form = e.currentTarget.closest("form");
              setStatus("active");
              setTimeout(() => {
                requestSubmit(form);
              }, 0);
            }}
          >
            {(isPending || uploadProgress) && status === "active" ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {uploadProgress?.message || "Publishing..."}
              </>
            ) : (
              "Publish"
            )}
          </Button>
        </div>
      </div>

      {/* Media Selector Dialog */}
      <UnifiedMediaSelector
        tenantId={tenantId}
        open={mediaSelectorOpen}
        onOpenChange={setMediaSelectorOpen}
        onSelect={handleMediaSelect}
        multiple
        selectedIds={images.map((img) => img.id)}
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

      {/* Variant Wizard */}
      <VariantWizard
        open={showVariantWizard}
        onOpenChange={(open) => {
          if (!open) {
            // When wizard closes (cancel, escape, or click outside), check if we have valid options
            // If not, reset hasVariants to false to restore the Inventory section
            const hasValidOptions = variantOptions.some(
              (opt) => opt.name.trim() && opt.values.length > 0
            );
            if (!hasValidOptions) {
              setHasVariants(false);
            }
          }
          setShowVariantWizard(open);
        }}
        tenantId={tenantId}
        options={variantOptions}
        onChange={(newOptions) => {
          handleVariantOptionsChange(newOptions);
          setShowVariantWizard(false);
        }}
      />
    </form>
  );
}
