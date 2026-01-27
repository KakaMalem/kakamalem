"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { Palette, Type, ImageIcon, Check, X, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  UnifiedMediaSelector,
  type MediaSelection,
} from "@/components/dashboard/media/unified-media-selector";
import { cn } from "@/lib/utils";
import { COLOR_PALETTE } from "@/lib/variants/option-templates";

export type SwatchType = "text" | "color" | "image";

export interface SwatchEditorProps {
  value: string; // The option value text (e.g., "Red", "S")
  swatchType: SwatchType;
  swatchValue?: string; // Hex color or media ID
  swatchImageUrl?: string; // Resolved image URL for display
  onSwatchChange: (type: SwatchType, value?: string, imageUrl?: string) => void;
  disabled?: boolean;
  tenantId: string;
}

export function SwatchEditor({
  value,
  swatchType,
  swatchValue,
  swatchImageUrl,
  onSwatchChange,
  disabled = false,
  tenantId,
}: SwatchEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customColor, setCustomColor] = useState(swatchValue || "#000000");
  const [showMediaSelector, setShowMediaSelector] = useState(false);

  // Sync customColor state when swatchValue prop changes
  useEffect(() => {
    if (swatchValue) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomColor(swatchValue);
    }
  }, [swatchValue]);

  const handleTypeChange = useCallback(
    (newType: string) => {
      if (newType === "text") {
        onSwatchChange("text", undefined, undefined);
      } else if (newType === "color") {
        onSwatchChange("color", customColor, undefined);
      } else if (newType === "image") {
        // Keep existing image if switching back
        onSwatchChange("image", swatchValue, swatchImageUrl);
      }
    },
    [customColor, onSwatchChange, swatchValue, swatchImageUrl]
  );

  const handleColorSelect = useCallback(
    (hex: string) => {
      setCustomColor(hex);
      onSwatchChange("color", hex, undefined);
    },
    [onSwatchChange]
  );

  const handleImageSelect = useCallback(
    (selection: MediaSelection | null) => {
      if (selection) {
        onSwatchChange("image", selection.id, selection.url);
      }
      setShowMediaSelector(false);
    },
    [onSwatchChange]
  );

  const handleRemoveImage = useCallback(() => {
    onSwatchChange("image", undefined, undefined);
  }, [onSwatchChange]);

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            className="h-7 w-7 shrink-0"
            aria-label={`Edit swatch for ${value}`}
          >
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Tabs
            defaultValue={swatchType}
            onValueChange={handleTypeChange}
            className="w-full"
          >
            <div className="border-b px-3 py-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Swatch Style</Label>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsOpen(false)}
                  className="h-6 w-6"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <TabsList className="w-full grid grid-cols-3 p-1 m-2 mb-0">
              <TabsTrigger
                value="text"
                className="flex items-center gap-1.5 text-xs"
              >
                <Type className="h-3.5 w-3.5" />
                Text
              </TabsTrigger>
              <TabsTrigger
                value="color"
                className="flex items-center gap-1.5 text-xs"
              >
                <Palette className="h-3.5 w-3.5" />
                Color
              </TabsTrigger>
              <TabsTrigger
                value="image"
                className="flex items-center gap-1.5 text-xs"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Image
              </TabsTrigger>
            </TabsList>

            {/* Text Tab */}
            <TabsContent value="text" className="p-3 pt-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted">
                  <span className="text-sm font-medium">
                    {value.slice(0, 2)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Display as text badge with the value &quot;{value}&quot;
                </p>
              </div>
            </TabsContent>

            {/* Color Tab */}
            <TabsContent value="color" className="p-3 pt-2 space-y-3">
              {/* Current color preview */}
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-md border shadow-sm"
                  style={{ backgroundColor: swatchValue || customColor }}
                />
                <div className="flex-1">
                  <Label
                    htmlFor="custom-color"
                    className="text-xs text-muted-foreground"
                  >
                    Custom color
                  </Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="custom-color"
                      type="color"
                      value={swatchValue || customColor}
                      onChange={(e) => handleColorSelect(e.target.value)}
                      className="h-8 w-12 p-0.5 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={swatchValue || customColor}
                      onChange={(e) => handleColorSelect(e.target.value)}
                      placeholder="#000000"
                      className="h-8 font-mono text-xs flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Color palette */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">
                  Quick colors
                </Label>
                <div className="grid grid-cols-8 gap-1.5">
                  {COLOR_PALETTE.slice(0, 24).map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => handleColorSelect(color.hex)}
                      className={cn(
                        "h-6 w-6 rounded-md border shadow-sm transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                        (swatchValue || customColor) === color.hex &&
                          "ring-2 ring-primary ring-offset-1"
                      )}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                      aria-label={`Select ${color.name}`}
                    >
                      {(swatchValue || customColor) === color.hex && (
                        <Check
                          className={cn(
                            "h-4 w-4 mx-auto",
                            isLightColor(color.hex)
                              ? "text-gray-800"
                              : "text-white"
                          )}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Image Tab */}
            <TabsContent value="image" className="p-3 pt-2 space-y-3">
              {swatchImageUrl ? (
                <div className="flex items-start gap-3">
                  <div className="relative h-16 w-16 rounded-md border overflow-hidden">
                    <Image
                      src={swatchImageUrl}
                      alt={`Swatch for ${value}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Image swatch selected
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowMediaSelector(true)}
                      >
                        Change
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveImage}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Select an image for this swatch
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMediaSelector(true)}
                  >
                    Choose Image
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>

      {/* Media Selector Dialog */}
      <UnifiedMediaSelector
        tenantId={tenantId}
        open={showMediaSelector}
        onOpenChange={setShowMediaSelector}
        onSelect={handleImageSelect}
        title="Select Swatch Image"
      />
    </>
  );
}

// Preview component for displaying swatches inline
export interface SwatchPreviewProps {
  type: SwatchType;
  value?: string; // Hex color or media ID
  imageUrl?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function SwatchPreview({
  type,
  value,
  imageUrl,
  size = "md",
  className,
}: SwatchPreviewProps) {
  const sizeClasses = {
    sm: "h-5 w-5",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  if (type === "color" && value) {
    return (
      <div
        className={cn(
          "rounded-md border shadow-sm",
          sizeClasses[size],
          className
        )}
        style={{ backgroundColor: value }}
        role="img"
        aria-label={`Color: ${value}`}
      />
    );
  }

  if (type === "image" && imageUrl) {
    return (
      <div
        className={cn(
          "relative rounded-md border overflow-hidden",
          sizeClasses[size],
          className
        )}
      >
        <Image src={imageUrl} alt="Swatch" fill className="object-cover" />
      </div>
    );
  }

  // Default text preview
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md border bg-muted",
        sizeClasses[size],
        className
      )}
    >
      <Type
        className={cn(
          size === "sm" ? "h-3 w-3" : "h-4 w-4",
          "text-muted-foreground"
        )}
      />
    </div>
  );
}

// Utility to determine if a color is light (for contrast)
function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}
