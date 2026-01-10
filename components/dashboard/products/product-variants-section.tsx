"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Pencil, Trash2, Package, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UnifiedMediaSelector,
  type MediaSelection,
} from "@/components/dashboard/media/unified-media-selector";

import type { VariantOptionWithValues } from "@/lib/db/queries/variants";
import type {
  ProductVariant,
  Media,
  ProductVariantImage,
} from "@/lib/db/schema";
import {
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
} from "@/lib/actions/variants";

type VariantImageWithMedia = ProductVariantImage & {
  media: Media;
};

type VariantWithOptions = ProductVariant & {
  options: {
    optionValue: {
      id: string;
      value: string;
      option: { id: string; name: string };
    };
  }[];
  image?: Media | null;
  images?: VariantImageWithMedia[];
};

interface ProductVariantsSectionProps {
  tenantId: string;
  productId: string;
  currency: string;
  basePrice: string;
  variantOptions: VariantOptionWithValues[];
  variants: VariantWithOptions[];
}

type VariantImage = {
  mediaId: string;
  url: string;
  position: number;
};

type FormData = {
  sku: string;
  price: string;
  weight: string;
  stock: string;
  isActive: boolean;
  optionValues: Record<string, string>;
  images: VariantImage[];
};

// Form component extracted outside to avoid creating during render
function VariantFormFields({
  formData,
  setFormData,
  variantOptions,
  currency,
  basePrice,
  tenantId,
  mediaSelectorOpen,
  setMediaSelectorOpen,
}: {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  variantOptions: VariantOptionWithValues[];
  currency: string;
  basePrice: string;
  tenantId: string;
  mediaSelectorOpen: boolean;
  setMediaSelectorOpen: (open: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Option Values */}
      {variantOptions.length > 0 && (
        <div className="space-y-3">
          <Label>Options</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {variantOptions.map((option) => (
              <div key={option.id} className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">
                  {option.name}
                </Label>
                <Select
                  value={formData.optionValues[option.id] || "none"}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      optionValues: {
                        ...prev.optionValues,
                        [option.id]: value === "none" ? "" : value,
                      },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${option.name}`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select {option.name}</SelectItem>
                    {option.values.map((value) => (
                      <SelectItem key={value.id} value={value.id}>
                        {value.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SKU */}
      <div className="space-y-2">
        <Label htmlFor="variant-sku">SKU (optional)</Label>
        <Input
          id="variant-sku"
          value={formData.sku}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, sku: e.target.value }))
          }
          placeholder="e.g., TSHIRT-BLUE-M"
        />
      </div>

      {/* Price & Stock */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="variant-price">Price Override ({currency})</Label>
          <Input
            id="variant-price"
            type="number"
            step="0.01"
            min="0"
            value={formData.price}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, price: e.target.value }))
            }
            placeholder={`Base: ${basePrice}`}
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to use base price
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="variant-stock">Stock</Label>
          <Input
            id="variant-stock"
            type="number"
            min="0"
            value={formData.stock}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, stock: e.target.value }))
            }
          />
        </div>
      </div>

      {/* Weight */}
      <div className="space-y-2">
        <Label htmlFor="variant-weight">Weight Override (kg)</Label>
        <Input
          id="variant-weight"
          type="number"
          step="0.001"
          min="0"
          value={formData.weight}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, weight: e.target.value }))
          }
          placeholder="Leave empty for base weight"
        />
      </div>

      {/* Images */}
      <div className="space-y-2">
        <Label>Variant Images (optional)</Label>
        <p className="text-xs text-muted-foreground">
          Add multiple images for this variant. The first image will be the
          primary image.
        </p>
        <div className="flex flex-wrap gap-2">
          {formData.images.map((img, index) => (
            <div
              key={img.mediaId}
              className="group relative size-16 overflow-hidden rounded-md border"
            >
              <Image
                src={img.url}
                alt={`Variant image ${index + 1}`}
                fill
                className="object-cover"
              />
              {index === 0 && (
                <div className="absolute left-1 top-1 rounded bg-primary px-1 py-0.5 text-[10px] font-medium text-primary-foreground">
                  Primary
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => ({
                    ...prev,
                    images: prev.images.filter((_, i) => i !== index),
                  }));
                }}
                className="absolute right-1 top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setMediaSelectorOpen(true)}
            className="flex size-16 cursor-pointer items-center justify-center rounded-md border-2 border-dashed hover:border-primary hover:bg-muted/50"
          >
            <Plus className="size-5 text-muted-foreground" />
          </button>
        </div>
        <UnifiedMediaSelector
          tenantId={tenantId}
          open={mediaSelectorOpen}
          onOpenChange={setMediaSelectorOpen}
          multiple
          selectedIds={formData.images.map((img) => img.mediaId)}
          onSelect={(selectedMedia) => {
            // Replace all images with the new selection
            const media = selectedMedia as MediaSelection[];
            setFormData((prev) => ({
              ...prev,
              images: media.map((m, index) => ({
                mediaId: m.id,
                url: m.url,
                position: index,
              })),
            }));
          }}
          title="Select Variant Images"
        />
      </div>

      {/* Active Status */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Active</Label>
          <p className="text-sm text-muted-foreground">
            Show this variant in your store
          </p>
        </div>
        <Switch
          checked={formData.isActive}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, isActive: checked }))
          }
        />
      </div>
    </div>
  );
}

export function ProductVariantsSection({
  tenantId,
  productId,
  currency,
  basePrice,
  variantOptions,
  variants,
}: ProductVariantsSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mediaSelectorOpen, setMediaSelectorOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] =
    useState<VariantWithOptions | null>(null);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    sku: "",
    price: "",
    weight: "",
    stock: "0",
    isActive: true,
    optionValues: {},
    images: [],
  });

  const resetForm = () => {
    setFormData({
      sku: "",
      price: "",
      weight: "",
      stock: "0",
      isActive: true,
      optionValues: {},
      images: [],
    });
  };

  const openEditDialog = (variant: VariantWithOptions) => {
    setSelectedVariant(variant);
    const optionValues: Record<string, string> = {};
    variant.options.forEach((opt) => {
      optionValues[opt.optionValue.option.id] = opt.optionValue.id;
    });

    // Convert variant images to form format
    const images: VariantImage[] =
      variant.images?.map((img, index) => ({
        mediaId: img.mediaId,
        url: img.media.url,
        position: img.position ?? index,
      })) ?? [];

    // If no images array but has legacy imageId, use that
    if (images.length === 0 && variant.image) {
      images.push({
        mediaId: variant.imageId!,
        url: variant.image.url,
        position: 0,
      });
    }

    setFormData({
      sku: variant.sku || "",
      price: variant.price || "",
      weight: variant.weight || "",
      stock: String(variant.stock),
      isActive: variant.isActive,
      optionValues,
      images,
    });
    setEditDialogOpen(true);
  };

  const handleCreate = async () => {
    // Validate option values
    if (variantOptions.length > 0) {
      const missingOptions = variantOptions.filter(
        (opt) => !formData.optionValues[opt.id]
      );
      if (missingOptions.length > 0) {
        toast.error(`Please select ${missingOptions[0].name}`);
        return;
      }
    }

    const result = await createProductVariant(tenantId, productId, {
      sku: formData.sku,
      price: formData.price,
      weight: formData.weight,
      stock: formData.stock,
      isActive: formData.isActive,
      optionValues: formData.optionValues,
      images: formData.images,
      displayOrder: variants.length,
    });

    if (result.success) {
      toast.success("Variant created");
      setCreateDialogOpen(false);
      resetForm();
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to create variant");
    }
  };

  const handleUpdate = async () => {
    if (!selectedVariant) return;

    const result = await updateProductVariant(tenantId, selectedVariant.id, {
      sku: formData.sku,
      price: formData.price,
      weight: formData.weight,
      stock: formData.stock,
      isActive: formData.isActive,
      optionValues: formData.optionValues,
      images: formData.images,
      displayOrder: selectedVariant.displayOrder,
    });

    if (result.success) {
      toast.success("Variant updated");
      setEditDialogOpen(false);
      setSelectedVariant(null);
      resetForm();
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to update variant");
    }
  };

  const handleDelete = async () => {
    if (!selectedVariant) return;

    const result = await deleteProductVariant(tenantId, selectedVariant.id);

    if (result.success) {
      toast.success("Variant deleted");
      setDeleteDialogOpen(false);
      setSelectedVariant(null);
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to delete variant");
    }
  };

  const formatPrice = (price: string | null) => {
    if (!price) return `${basePrice} ${currency}`;
    return `${parseFloat(price).toLocaleString()} ${currency}`;
  };

  const getVariantDisplayName = (variant: VariantWithOptions) => {
    if (variant.displayName) return variant.displayName;
    return (
      variant.options.map((opt) => opt.optionValue.value).join(" / ") ||
      "Variant"
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Variants</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Create variants for different sizes, colors, etc.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              resetForm();
              setCreateDialogOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            Add Variant
          </Button>
        </CardHeader>
        <CardContent>
          {variantOptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="mb-2 size-8 text-muted-foreground" />
              <p className="mb-2 text-muted-foreground">
                No variant options defined
              </p>
              <p className="mb-4 text-sm text-muted-foreground">
                Create variant options like Size or Color in the Variants page
                first.
              </p>
            </div>
          ) : variants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="mb-2 size-8 text-muted-foreground" />
              <p className="text-muted-foreground">No variants yet</p>
              <p className="text-sm text-muted-foreground">
                Add variants to sell different options of this product.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variant</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants.map((variant) => (
                    <TableRow key={variant.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative size-10 overflow-hidden rounded-md bg-muted">
                            {variant.images?.[0]?.media?.url ||
                            variant.image?.url ? (
                              <>
                                <Image
                                  src={
                                    variant.images?.[0]?.media?.url ||
                                    variant.image?.url ||
                                    ""
                                  }
                                  alt={getVariantDisplayName(variant)}
                                  fill
                                  className="object-cover"
                                />
                                {(variant.images?.length ?? 0) > 1 && (
                                  <div className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 py-0.5 text-[10px] font-medium text-white">
                                    +{(variant.images?.length ?? 0) - 1}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="flex size-full items-center justify-center">
                                <Package className="size-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <span className="font-medium">
                            {getVariantDisplayName(variant)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {variant.sku || "-"}
                      </TableCell>
                      <TableCell>{formatPrice(variant.price)}</TableCell>
                      <TableCell>{variant.stock}</TableCell>
                      <TableCell>
                        {variant.isActive ? (
                          <Badge>Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEditDialog(variant)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setSelectedVariant(variant);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Variant</DialogTitle>
            <DialogDescription>
              Create a new product variant with specific options.
            </DialogDescription>
          </DialogHeader>
          <VariantFormFields
            formData={formData}
            setFormData={setFormData}
            variantOptions={variantOptions}
            currency={currency}
            basePrice={basePrice}
            tenantId={tenantId}
            mediaSelectorOpen={mediaSelectorOpen}
            setMediaSelectorOpen={setMediaSelectorOpen}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreate} disabled={isPending}>
              Create Variant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Variant</DialogTitle>
            <DialogDescription>Update this product variant.</DialogDescription>
          </DialogHeader>
          <VariantFormFields
            formData={formData}
            setFormData={setFormData}
            variantOptions={variantOptions}
            currency={currency}
            basePrice={basePrice}
            tenantId={tenantId}
            mediaSelectorOpen={mediaSelectorOpen}
            setMediaSelectorOpen={setMediaSelectorOpen}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleUpdate} disabled={isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Variant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this variant? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
