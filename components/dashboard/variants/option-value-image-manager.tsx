"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ImageIcon, ChevronDown, ChevronRight, Link2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SwatchPreview } from "./swatch-editor";
import { cn } from "@/lib/utils";
import type { InlineOption } from "@/lib/validations/variant-form";

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

// Type for image assignments per option value
export type OptionValueImageAssignment = {
  optionId: string; // ID or tempId of the option
  optionName: string;
  valueId: string; // ID or value string for new values
  value: string;
  imageIds: string[]; // Media IDs assigned to this value
};

// Type for product images with full media info
export type ProductImageWithMedia = {
  id: string;
  mediaId: string;
  url: string;
  altText?: string | null;
  position: number;
};

interface OptionValueImageManagerProps {
  /** Variant options configured for this product */
  options: InlineOption[];
  /** Product images available for assignment */
  productImages: ProductImageWithMedia[];
  /** Current image assignments */
  assignments: OptionValueImageAssignment[];
  /** Callback when assignments change */
  onAssignmentsChange: (assignments: OptionValueImageAssignment[]) => void;
  /** Whether to show option values with color/image swatches prominently */
  emphasizeVisualOptions?: boolean;
}

export function OptionValueImageManager({
  options,
  productImages,
  assignments,
  onAssignmentsChange,
  emphasizeVisualOptions = true,
}: OptionValueImageManagerProps) {
  // Track hydration - only render Collapsible after mount to avoid ID mismatch
  const [mounted, setMounted] = useState(false);

  // Track which options are expanded
  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(
    new Set(options.map((opt) => opt.id || opt.tempId || ""))
  );

  // Set mounted after hydration to avoid Radix ID mismatch
  // This is a valid pattern for client-only rendering to prevent hydration errors
  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  // Get assignment for a specific value
  const getAssignment = useCallback(
    (
      optionId: string,
      valueId: string
    ): OptionValueImageAssignment | undefined => {
      return assignments.find(
        (a) => a.optionId === optionId && a.valueId === valueId
      );
    },
    [assignments]
  );

  // Get images for a specific value
  const getImagesForValue = useCallback(
    (optionId: string, valueId: string): ProductImageWithMedia[] => {
      const assignment = getAssignment(optionId, valueId);
      if (!assignment) return [];
      return assignment.imageIds
        .map((id) => productImages.find((img) => img.mediaId === id))
        .filter((img): img is ProductImageWithMedia => img !== undefined);
    },
    [getAssignment, productImages]
  );

  // Update assignment for a value
  const updateAssignment = useCallback(
    (
      optionId: string,
      optionName: string,
      valueId: string,
      value: string,
      imageIds: string[]
    ) => {
      const existingIndex = assignments.findIndex(
        (a) => a.optionId === optionId && a.valueId === valueId
      );

      let newAssignments: OptionValueImageAssignment[];

      if (imageIds.length === 0) {
        // Remove assignment if no images
        if (existingIndex >= 0) {
          newAssignments = assignments.filter((_, i) => i !== existingIndex);
        } else {
          return; // Nothing to update
        }
      } else if (existingIndex >= 0) {
        // Update existing
        newAssignments = [...assignments];
        newAssignments[existingIndex] = {
          ...newAssignments[existingIndex],
          imageIds,
        };
      } else {
        // Add new
        newAssignments = [
          ...assignments,
          { optionId, optionName, valueId, value, imageIds },
        ];
      }

      onAssignmentsChange(newAssignments);
    },
    [assignments, onAssignmentsChange]
  );

  // Quick assign: assign an image to a value via drag or click
  const quickAssign = useCallback(
    (
      optionId: string,
      optionName: string,
      valueId: string,
      value: string,
      mediaId: string
    ) => {
      const assignment = getAssignment(optionId, valueId);
      const currentImageIds = assignment?.imageIds || [];

      if (currentImageIds.includes(mediaId)) {
        // Remove if already assigned
        updateAssignment(
          optionId,
          optionName,
          valueId,
          value,
          currentImageIds.filter((id) => id !== mediaId)
        );
      } else {
        // Add if not assigned
        updateAssignment(optionId, optionName, valueId, value, [
          ...currentImageIds,
          mediaId,
        ]);
      }
    },
    [getAssignment, updateAssignment]
  );

  // Toggle option expansion
  const toggleOption = useCallback((optionId: string) => {
    setExpandedOptions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(optionId)) {
        newSet.delete(optionId);
      } else {
        newSet.add(optionId);
      }
      return newSet;
    });
  }, []);

  // Filter to show visual options first if emphasized
  const sortedOptions = useMemo(() => {
    if (!emphasizeVisualOptions) return options;

    return [...options].sort((a, b) => {
      const aHasVisual = a.values.some(
        (v) => v.swatchType === "color" || v.swatchType === "image"
      );
      const bHasVisual = b.values.some(
        (v) => v.swatchType === "color" || v.swatchType === "image"
      );
      if (aHasVisual && !bHasVisual) return -1;
      if (!aHasVisual && bHasVisual) return 1;
      return 0;
    });
  }, [options, emphasizeVisualOptions]);

  if (productImages.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Add product images first to assign them to variant options.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (options.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Configure variant options first to assign images.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Variant Image Mapping</CardTitle>
          <CardDescription>
            Assign product images to variant options. When customers select an
            option, the gallery will filter to show relevant images.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product images quick reference */}
          <div className="p-3 rounded-lg bg-muted/50">
            <Label className="text-sm font-medium mb-2 block">
              Product Images ({productImages.length})
            </Label>
            <div className="flex gap-2 flex-wrap">
              {productImages.map((img) => (
                <div
                  key={img.mediaId}
                  className="relative h-12 w-12 rounded-md border overflow-hidden shrink-0"
                >
                  <Image
                    src={img.url}
                    alt={img.altText || "Product image"}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Options with value assignments */}
          <div className="space-y-3">
            {!mounted
              ? // Skeleton while waiting for hydration
                sortedOptions.map((option) => {
                  const optionId = option.id || option.tempId || "";
                  return (
                    <div key={optionId} className="rounded-lg border">
                      <div className="flex items-center justify-between w-full p-3">
                        <div className="flex items-center gap-2">
                          <ChevronDown className="h-4 w-4" />
                          <span className="font-medium">{option.name}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {option.values.length} value
                          {option.values.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                    </div>
                  );
                })
              : sortedOptions.map((option) => {
                  const optionId = option.id || option.tempId || "";
                  const isExpanded = expandedOptions.has(optionId);
                  const hasVisualValues = option.values.some(
                    (v) => v.swatchType === "color" || v.swatchType === "image"
                  );

                  return (
                    <Collapsible
                      key={optionId}
                      open={isExpanded}
                      onOpenChange={() => toggleOption(optionId)}
                    >
                      <div className="rounded-lg border">
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center justify-between w-full p-3 text-left hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <span className="font-medium">{option.name}</span>
                              {hasVisualValues && (
                                <Badge variant="secondary" className="text-xs">
                                  Visual
                                </Badge>
                              )}
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {option.values.length} value
                              {option.values.length !== 1 ? "s" : ""}
                            </Badge>
                          </button>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="p-3 pt-0 space-y-3">
                            {option.values.map((value) => {
                              const valueId = value.id || value.value;
                              const assignedImages = getImagesForValue(
                                optionId,
                                valueId
                              );

                              return (
                                <motion.div
                                  key={valueId}
                                  variants={fadeInUp}
                                  initial="initial"
                                  animate="animate"
                                  className="p-3 rounded-lg border bg-card"
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <SwatchPreview
                                        type={value.swatchType || "text"}
                                        value={value.swatchValue}
                                        imageUrl={value.swatchImageUrl}
                                        size="md"
                                      />
                                      <span className="font-medium">
                                        {value.value}
                                      </span>
                                      {assignedImages.length > 0 && (
                                        <Badge
                                          variant="secondary"
                                          className="text-xs"
                                        >
                                          <Link2 className="h-3 w-3 mr-1" />
                                          {assignedImages.length} image
                                          {assignedImages.length !== 1
                                            ? "s"
                                            : ""}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  {/* Selectable product images - click to toggle selection */}
                                  <div className="flex gap-2 flex-wrap">
                                    {productImages.map((img) => {
                                      const isSelected = assignedImages.some(
                                        (a) => a.mediaId === img.mediaId
                                      );
                                      return (
                                        <button
                                          key={img.mediaId}
                                          type="button"
                                          onClick={() =>
                                            quickAssign(
                                              optionId,
                                              option.name,
                                              valueId,
                                              value.value,
                                              img.mediaId
                                            )
                                          }
                                          className={cn(
                                            "relative h-14 w-14 rounded-md border-2 overflow-hidden transition-all",
                                            isSelected
                                              ? "border-primary ring-2 ring-primary/30"
                                              : "border-muted hover:border-muted-foreground/50 opacity-60 hover:opacity-100"
                                          )}
                                        >
                                          <Image
                                            src={img.url}
                                            alt={img.altText || "Product image"}
                                            fill
                                            className="object-cover"
                                          />
                                          {isSelected && (
                                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                              <div className="bg-primary rounded-full p-0.5">
                                                <svg
                                                  className="h-3 w-3 text-primary-foreground"
                                                  fill="none"
                                                  viewBox="0 0 24 24"
                                                  stroke="currentColor"
                                                  strokeWidth={3}
                                                >
                                                  <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M5 13l4 4L19 7"
                                                  />
                                                </svg>
                                              </div>
                                            </div>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// Missing Label component
function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    >
      {children}
    </label>
  );
}
