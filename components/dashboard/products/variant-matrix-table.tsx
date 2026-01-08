"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Check,
  X,
  MoreHorizontal,
  Trash2,
  Copy,
  ChevronUp,
  ImageIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import type { GeneratedVariant } from "@/lib/validations/variant-form";
import { groupVariantsByFirstOptionGeneric } from "@/lib/variants/cartesian";
import { UnifiedMediaSelector, type MediaSelection } from "@/components/dashboard/media/unified-media-selector";

interface VariantMatrixTableProps {
  /** Generated variants to display */
  variants: GeneratedVariant[];
  /** Callback when variants change */
  onChange: (variants: GeneratedVariant[]) => void;
  /** Currency symbol/code for price display */
  currency: string;
  /** Base product slug for SKU generation */
  productSlug: string;
  /** Whether the table is disabled */
  disabled?: boolean;
  /** Errors for specific variants */
  variantErrors?: Record<
    string,
    Partial<Record<keyof GeneratedVariant, string>>
  >;
  /** Tenant ID for media selector */
  tenantId?: string;
  /** Whether inventory tracking is enabled */
  trackInventory?: boolean;
}

export function VariantMatrixTable({
  variants,
  onChange,
  currency,
  productSlug: _productSlug,
  disabled = false,
  variantErrors = {},
  tenantId,
  trackInventory = true,
}: VariantMatrixTableProps) {
  // productSlug reserved for future SKU regeneration feature
  void _productSlug;
  // Bulk edit state
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");

  // Collapsed groups state (for first option grouping)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );

  // Expanded variant details state (for showing dimensions/description)
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(
    new Set()
  );

  // Group variants by first option value for collapsible sections
  const groupedVariants = useMemo(() => {
    return groupVariantsByFirstOptionGeneric(
      variants.filter((v) => !v.isExcluded)
    );
  }, [variants]);

  const hasGroups = groupedVariants.size > 1;

  // Detect duplicate SKUs
  const skuErrors = useMemo(() => {
    const errors: Record<
      string,
      Partial<Record<keyof GeneratedVariant, string>>
    > = {};
    const skuMap = new Map<string, string[]>(); // sku -> tempIds

    for (const variant of variants) {
      if (variant.isExcluded || !variant.sku.trim()) continue;
      const sku = variant.sku.trim().toLowerCase();
      if (!skuMap.has(sku)) {
        skuMap.set(sku, []);
      }
      skuMap.get(sku)!.push(variant.tempId);
    }

    // Mark duplicates
    for (const [, tempIds] of skuMap) {
      if (tempIds.length > 1) {
        for (const tempId of tempIds) {
          errors[tempId] = { sku: "Duplicate SKU" };
        }
      }
    }

    return errors;
  }, [variants]);

  // Merge external errors with SKU errors
  const allVariantErrors = useMemo(() => {
    const merged: Record<
      string,
      Partial<Record<keyof GeneratedVariant, string>>
    > = { ...variantErrors };
    for (const [tempId, error] of Object.entries(skuErrors)) {
      merged[tempId] = { ...merged[tempId], ...error };
    }
    return merged;
  }, [variantErrors, skuErrors]);

  // Update a single variant field
  const updateVariant = useCallback(
    (
      tempId: string,
      field: keyof GeneratedVariant,
      value: string | boolean | string[]
    ) => {
      const newVariants = variants.map((v) =>
        v.tempId === tempId ? { ...v, [field]: value } : v
      );
      onChange(newVariants);
    },
    [variants, onChange]
  );

  // Toggle variant exclusion
  const toggleExclude = useCallback(
    (tempId: string) => {
      const newVariants = variants.map((v) =>
        v.tempId === tempId ? { ...v, isExcluded: !v.isExcluded } : v
      );
      onChange(newVariants);
    },
    [variants, onChange]
  );

  // Apply bulk price to all variants
  const applyBulkPrice = useCallback(() => {
    if (!bulkPrice.trim()) return;

    const newVariants = variants.map((v) =>
      v.isExcluded ? v : { ...v, price: bulkPrice }
    );
    onChange(newVariants);
    setBulkPrice("");
  }, [variants, onChange, bulkPrice]);

  // Apply bulk stock to all variants
  const applyBulkStock = useCallback(() => {
    if (!bulkStock.trim()) return;

    const newVariants = variants.map((v) =>
      v.isExcluded ? v : { ...v, stock: bulkStock }
    );
    onChange(newVariants);
    setBulkStock("");
  }, [variants, onChange, bulkStock]);

  // Activate/deactivate all variants
  const setAllActive = useCallback(
    (isActive: boolean) => {
      const newVariants = variants.map((v) =>
        v.isExcluded ? v : { ...v, isActive }
      );
      onChange(newVariants);
    },
    [variants, onChange]
  );

  // Copy SKU from one row to generate pattern for others
  const copyPriceFromAbove = useCallback(
    (tempId: string) => {
      const index = variants.findIndex((v) => v.tempId === tempId);
      if (index <= 0) return;

      const previousVariant = variants[index - 1];
      const newVariants = variants.map((v) =>
        v.tempId === tempId ? { ...v, price: previousVariant.price } : v
      );
      onChange(newVariants);
    },
    [variants, onChange]
  );

  // Toggle group collapse
  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  // Toggle variant details expansion
  const toggleVariantExpansion = (tempId: string) => {
    setExpandedVariants((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) {
        next.delete(tempId);
      } else {
        next.add(tempId);
      }
      return next;
    });
  };

  // Count active variants
  const activeCount = variants.filter((v) => !v.isExcluded).length;
  const excludedCount = variants.filter((v) => v.isExcluded).length;

  if (variants.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <p className="text-center text-sm text-muted-foreground">
            Add variant options above to generate the variant matrix.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 w-full max-w-full overflow-hidden">
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">Variant Matrix</Label>
          <p className="text-sm text-muted-foreground">
            {activeCount} variant{activeCount !== 1 ? "s" : ""} will be created
            {excludedCount > 0 && (
              <span className="ml-1 text-yellow-600">
                ({excludedCount} excluded)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Bulk Actions */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Bulk Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-hidden">
          <div
            className={
              trackInventory ? "grid gap-4 grid-cols-1 sm:grid-cols-2" : ""
            }
          >
            {/* Bulk Price */}
            <div className="flex items-end gap-2 min-w-0">
              <div className="flex-1 space-y-1.5 min-w-0">
                <Label htmlFor="bulkPrice" className="text-xs">
                  Set all prices ({currency})
                </Label>
                <Input
                  id="bulkPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={bulkPrice}
                  onChange={(e) => setBulkPrice(e.target.value)}
                  placeholder="0.00"
                  disabled={disabled}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyBulkPrice();
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={applyBulkPrice}
                disabled={disabled || !bulkPrice.trim()}
              >
                Apply
              </Button>
            </div>

            {/* Bulk Stock - Only show if tracking inventory */}
            {trackInventory && (
              <div className="flex items-end gap-2 min-w-0">
                <div className="flex-1 space-y-1.5 min-w-0">
                  <Label htmlFor="bulkStock" className="text-xs">
                    Set all stock
                  </Label>
                  <Input
                    id="bulkStock"
                    type="number"
                    min="0"
                    value={bulkStock}
                    onChange={(e) => setBulkStock(e.target.value)}
                    placeholder="0"
                    disabled={disabled}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyBulkStock();
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={applyBulkStock}
                  disabled={disabled || !bulkStock.trim()}
                >
                  Apply
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Active Toggle Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAllActive(true)}
              disabled={disabled}
            >
              <Check className="mr-2 size-4" />
              Activate All
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAllActive(false)}
              disabled={disabled}
            >
              <X className="mr-2 size-4" />
              Deactivate All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Variants Table */}
      <p className="text-sm text-muted-foreground md:hidden">
        Tip: Swipe to see all columns
      </p>
      <div className="w-full overflow-x-auto rounded-md border">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead className="min-w-40">Variant</TableHead>
              <TableHead className="min-w-30">SKU</TableHead>
              <TableHead className="min-w-27.5">Price ({currency})</TableHead>
              {trackInventory && (
                <TableHead className="min-w-25">Stock</TableHead>
              )}
              <TableHead className="min-w-20 text-center">Active</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hasGroups
              ? // Render grouped variants with collapsible sections
                Array.from(groupedVariants.entries()).map(
                  ([groupKey, groupVariants]) => {
                    const isCollapsed = collapsedGroups.has(groupKey);

                    return (
                      <React.Fragment key={groupKey}>
                        {/* Group Header Row */}
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableCell colSpan={trackInventory ? 7 : 6}>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 text-left font-medium"
                              onClick={() => toggleGroup(groupKey)}
                            >
                              {isCollapsed ? (
                                <ChevronRight className="size-4" />
                              ) : (
                                <ChevronDown className="size-4" />
                              )}
                              {groupKey}
                              <Badge variant="secondary" className="ml-2">
                                {groupVariants.length}
                              </Badge>
                            </button>
                          </TableCell>
                        </TableRow>

                        {/* Group Variants */}
                        {!isCollapsed &&
                          groupVariants.map((variant, index) => (
                            <VariantRow
                              key={variant.tempId}
                              variant={variant}
                              disabled={disabled}
                              errors={allVariantErrors[variant.tempId]}
                              onUpdate={updateVariant}
                              onToggleExclude={toggleExclude}
                              onCopyFromAbove={copyPriceFromAbove}
                              showCopyFromAbove={index > 0}
                              isGrouped
                              isExpanded={expandedVariants.has(variant.tempId)}
                              onToggleExpand={toggleVariantExpansion}
                              tenantId={tenantId}
                              trackInventory={trackInventory}
                            />
                          ))}
                      </React.Fragment>
                    );
                  }
                )
              : // Render flat list
                variants.map((variant, index) => (
                  <VariantRow
                    key={variant.tempId}
                    variant={variant}
                    disabled={disabled}
                    errors={allVariantErrors[variant.tempId]}
                    onUpdate={updateVariant}
                    onToggleExclude={toggleExclude}
                    onCopyFromAbove={copyPriceFromAbove}
                    showCopyFromAbove={index > 0}
                    isExpanded={expandedVariants.has(variant.tempId)}
                    onToggleExpand={toggleVariantExpansion}
                    tenantId={tenantId}
                    trackInventory={trackInventory}
                  />
                ))}
          </TableBody>
        </Table>
      </div>

      {/* Excluded variants notice */}
      {excludedCount > 0 && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">{excludedCount}</span> variant
          {excludedCount !== 1 ? "s" : ""} excluded from creation. Use the row
          menu to include them again.
        </p>
      )}
    </div>
  );
}

// Individual variant row component
interface VariantRowProps {
  variant: GeneratedVariant;
  disabled: boolean;
  errors?: Partial<Record<keyof GeneratedVariant, string>>;
  onUpdate: (
    tempId: string,
    field: keyof GeneratedVariant,
    value: string | boolean | string[]
  ) => void;
  onToggleExclude: (tempId: string) => void;
  onCopyFromAbove: (tempId: string) => void;
  showCopyFromAbove: boolean;
  isGrouped?: boolean;
  isExpanded: boolean;
  onToggleExpand: (tempId: string) => void;
  tenantId?: string;
  trackInventory?: boolean;
}

function VariantRow({
  variant,
  disabled,
  errors,
  onUpdate,
  onToggleExclude,
  onCopyFromAbove,
  showCopyFromAbove,
  isGrouped,
  isExpanded,
  onToggleExpand,
  tenantId,
  trackInventory = true,
}: VariantRowProps) {
  const isExcluded = variant.isExcluded;
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);

  return (
    <>
      <TableRow
        className={cn(
          isExcluded && "opacity-50 bg-muted/30",
          isGrouped && "bg-background"
        )}
      >
        {/* Expand Button */}
        <TableCell className="w-12.5">
          {!isExcluded && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onToggleExpand(variant.tempId)}
            >
              {isExpanded ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
              <span className="sr-only">
                {isExpanded ? "Collapse" : "Expand"} details
              </span>
            </Button>
          )}
        </TableCell>

        {/* Variant Name */}
        <TableCell>
          <div className={cn("flex items-center gap-2", isGrouped && "pl-6")}>
            <span className={cn(isExcluded && "line-through")}>
              {variant.displayName}
            </span>
            {isExcluded && (
              <Badge variant="outline" className="text-xs">
                Excluded
              </Badge>
            )}
          </div>
        </TableCell>

        {/* SKU */}
        <TableCell>
          <Input
            value={variant.sku}
            onChange={(e) =>
              onUpdate(variant.tempId, "sku", e.target.value.toUpperCase())
            }
            placeholder="Auto-generated"
            disabled={disabled || isExcluded}
            className={cn(
              "h-8 uppercase",
              errors?.sku && "border-destructive",
              isExcluded && "opacity-50"
            )}
          />
        </TableCell>

        {/* Price */}
        <TableCell>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={variant.price}
            onChange={(e) => onUpdate(variant.tempId, "price", e.target.value)}
            placeholder="Base"
            disabled={disabled || isExcluded}
            className={cn(
              "h-8",
              errors?.price && "border-destructive",
              isExcluded && "opacity-50"
            )}
          />
        </TableCell>

        {/* Stock */}
        {trackInventory && (
          <TableCell>
            <Input
              type="number"
              min="0"
              value={variant.stock}
              onChange={(e) =>
                onUpdate(variant.tempId, "stock", e.target.value)
              }
              placeholder="0"
              disabled={disabled || isExcluded}
              className={cn(
                "h-8",
                errors?.stock && "border-destructive",
                isExcluded && "opacity-50"
              )}
            />
          </TableCell>
        )}

        {/* Active Toggle */}
        <TableCell className="text-center">
          <Switch
            checked={variant.isActive}
            onCheckedChange={(checked) =>
              onUpdate(variant.tempId, "isActive", checked)
            }
            disabled={disabled || isExcluded}
          />
        </TableCell>

        {/* Actions */}
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {showCopyFromAbove && !isExcluded && (
                <>
                  <DropdownMenuItem
                    onClick={() => onCopyFromAbove(variant.tempId)}
                  >
                    <Copy className="mr-2 size-4" />
                    Copy price from above
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => onToggleExclude(variant.tempId)}>
                {isExcluded ? (
                  <>
                    <Check className="mr-2 size-4" />
                    Include variant
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 size-4" />
                    Exclude variant
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {/* Details Row - Expandable */}
      {isExpanded && !isExcluded && (
        <TableRow className={cn(isGrouped && "bg-background")}>
          <TableCell
            colSpan={trackInventory ? 7 : 6}
            className="bg-muted/20 p-4"
          >
            <div className="space-y-4">
              {/* Variant Images */}
              <div className="space-y-3">
                <Label className="text-xs font-medium text-muted-foreground">
                  Variant Images
                </Label>
                {variant.imageIds && variant.imageIds.length > 0 ? (
                  <div className="space-y-3">
                    {/* Image count indicator with thumbnails placeholder */}
                    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex size-10 items-center justify-center rounded-md border-2 border-dashed bg-background">
                          <ImageIcon className="size-5 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {variant.imageIds.length} image
                            {variant.imageIds.length !== 1 ? "s" : ""} selected
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Click manage to view and reorder
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setMediaDialogOpen(true)}
                        disabled={disabled}
                      >
                        <ImageIcon className="mr-2 size-3.5" />
                        Manage Images
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onUpdate(variant.tempId, "imageIds", [])}
                        disabled={disabled}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="mr-1.5 size-3.5" />
                        Clear All
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setMediaDialogOpen(true)}
                      disabled={disabled}
                      className="w-full justify-start"
                    >
                      <ImageIcon className="mr-2 size-4" />
                      Select Images for This Variant
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Optional: Add specific images for this variant (e.g.,
                      different color/style)
                    </p>
                  </div>
                )}
              </div>

              {/* Weight and Dimensions */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Shipping Details
                </Label>
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor={`weight-${variant.tempId}`}
                      className="text-xs"
                    >
                      Weight (kg)
                    </Label>
                    <Input
                      id={`weight-${variant.tempId}`}
                      type="number"
                      min="0"
                      step="0.001"
                      value={variant.weight}
                      onChange={(e) =>
                        onUpdate(variant.tempId, "weight", e.target.value)
                      }
                      placeholder="Base"
                      disabled={disabled}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor={`length-${variant.tempId}`}
                      className="text-xs"
                    >
                      Length (cm)
                    </Label>
                    <Input
                      id={`length-${variant.tempId}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={variant.length}
                      onChange={(e) =>
                        onUpdate(variant.tempId, "length", e.target.value)
                      }
                      placeholder="Base"
                      disabled={disabled}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor={`width-${variant.tempId}`}
                      className="text-xs"
                    >
                      Width (cm)
                    </Label>
                    <Input
                      id={`width-${variant.tempId}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={variant.width}
                      onChange={(e) =>
                        onUpdate(variant.tempId, "width", e.target.value)
                      }
                      placeholder="Base"
                      disabled={disabled}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor={`height-${variant.tempId}`}
                      className="text-xs"
                    >
                      Height (cm)
                    </Label>
                    <Input
                      id={`height-${variant.tempId}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={variant.height}
                      onChange={(e) =>
                        onUpdate(variant.tempId, "height", e.target.value)
                      }
                      placeholder="Base"
                      disabled={disabled}
                      className="h-8"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <Label
                  htmlFor={`description-${variant.tempId}`}
                  className="text-xs font-medium text-muted-foreground mb-2 block"
                >
                  Variant Description
                </Label>
                <Textarea
                  id={`description-${variant.tempId}`}
                  value={variant.description}
                  onChange={(e) =>
                    onUpdate(variant.tempId, "description", e.target.value)
                  }
                  placeholder="Optional variant-specific description (e.g., 'This color runs slightly smaller')"
                  disabled={disabled}
                  className="min-h-20 resize-none"
                />
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}

      {/* Media Selector Dialog */}
      {tenantId && (
        <UnifiedMediaSelector
          tenantId={tenantId}
          open={mediaDialogOpen}
          onOpenChange={setMediaDialogOpen}
          multiple
          selectedIds={variant.imageIds || []}
          onSelect={(media: MediaSelection[]) => {
            const imageIds = media.map((m) => m.id);
            onUpdate(variant.tempId, "imageIds", imageIds);
          }}
          title="Select Variant Images"
        />
      )}
    </>
  );
}
