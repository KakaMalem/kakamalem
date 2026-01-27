"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;
import {
  ChevronDown,
  ChevronRight,
  Check,
  MoreHorizontal,
  Trash2,
  Copy,
  ChevronUp,
  Camera,
  Barcode,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
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
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { GeneratedVariant } from "@/lib/validations/variant-form";
import { groupVariantsByFirstOptionGeneric } from "@/lib/variants/cartesian";
import { BarcodeScanner } from "@/components/dashboard/pos/barcode-scanner";

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
  /** Whether inventory tracking is enabled */
  trackInventory?: boolean;
  /** Scanner mode for barcode input: "camera" shows camera button, "usb" relies on native input */
  scannerMode?: "camera" | "usb";
}

export function VariantMatrixTable({
  variants,
  onChange,
  currency,
  productSlug: _productSlug,
  disabled = false,
  variantErrors = {},
  trackInventory = true,
  scannerMode = "usb",
}: VariantMatrixTableProps) {
  // productSlug reserved for future SKU regeneration feature
  void _productSlug;

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

  // Detect duplicate barcodes
  const barcodeErrors = useMemo(() => {
    const errors: Record<
      string,
      Partial<Record<keyof GeneratedVariant, string>>
    > = {};
    const barcodeMap = new Map<string, string[]>(); // barcode -> tempIds

    for (const variant of variants) {
      if (variant.isExcluded || !variant.barcode.trim()) continue;
      const barcode = variant.barcode.trim();
      if (!barcodeMap.has(barcode)) {
        barcodeMap.set(barcode, []);
      }
      barcodeMap.get(barcode)!.push(variant.tempId);
    }

    // Mark duplicates
    for (const [, tempIds] of barcodeMap) {
      if (tempIds.length > 1) {
        for (const tempId of tempIds) {
          errors[tempId] = { barcode: "Duplicate barcode" };
        }
      }
    }

    return errors;
  }, [variants]);

  // Merge external errors with barcode errors
  const allVariantErrors = useMemo(() => {
    const merged: Record<
      string,
      Partial<Record<keyof GeneratedVariant, string>>
    > = { ...variantErrors };
    for (const [tempId, error] of Object.entries(barcodeErrors)) {
      merged[tempId] = { ...merged[tempId], ...error };
    }
    return merged;
  }, [variantErrors, barcodeErrors]);

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
              <TableHead
                className={scannerMode === "camera" ? "min-w-40" : "min-w-30"}
              >
                <span className="flex items-center gap-1.5">
                  <Barcode className="size-4" />
                  Barcode
                </span>
              </TableHead>
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
                              trackInventory={trackInventory}
                              scannerMode={scannerMode}
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
                    trackInventory={trackInventory}
                    scannerMode={scannerMode}
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
  trackInventory?: boolean;
  scannerMode?: "camera" | "usb";
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
  trackInventory = true,
  scannerMode = "usb",
}: VariantRowProps) {
  const isExcluded = variant.isExcluded;
  const [scannerOpen, setScannerOpen] = useState(false);
  // Track mounted state to prevent hydration mismatch with Radix dropdown IDs
  const mounted = useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot
  );

  const handleBarcodeScan = useCallback(
    (barcode: string) => {
      onUpdate(variant.tempId, "barcode", barcode);
      setScannerOpen(false);
    },
    [onUpdate, variant.tempId]
  );

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

        {/* Barcode */}
        <TableCell>
          <div className="flex gap-1">
            <Input
              value={variant.barcode}
              onChange={(e) =>
                onUpdate(variant.tempId, "barcode", e.target.value)
              }
              placeholder="Scan or enter"
              disabled={disabled || isExcluded}
              className={cn(
                "h-8 flex-1",
                errors?.barcode && "border-destructive",
                isExcluded && "opacity-50"
              )}
            />
            {scannerMode === "camera" && !isExcluded && !disabled && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => setScannerOpen(true)}
              >
                <Camera className="size-4" />
              </Button>
            )}
          </div>
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
            onWheel={(e) => e.currentTarget.blur()}
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
              onWheel={(e) => e.currentTarget.blur()}
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
          {mounted ? (
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
                <DropdownMenuItem
                  onClick={() => onToggleExclude(variant.tempId)}
                >
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
          ) : (
            <Button variant="ghost" size="icon" className="size-8" disabled>
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Actions</span>
            </Button>
          )}
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
                      onWheel={(e) => e.currentTarget.blur()}
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
                      onWheel={(e) => e.currentTarget.blur()}
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
                      onWheel={(e) => e.currentTarget.blur()}
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
                      onWheel={(e) => e.currentTarget.blur()}
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
                <RichTextEditor
                  id={`description-${variant.tempId}`}
                  value={variant.description}
                  onChange={(value) =>
                    onUpdate(variant.tempId, "description", value)
                  }
                  placeholder="Optional variant-specific description (e.g., 'This color runs slightly smaller')"
                  disabled={disabled}
                  minHeight="80px"
                />
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}

      {/* Camera barcode scanner dialog */}
      {scannerMode === "camera" && (
        <BarcodeScanner
          open={scannerOpen}
          onOpenChange={setScannerOpen}
          onScan={handleBarcodeScan}
        />
      )}
    </>
  );
}
