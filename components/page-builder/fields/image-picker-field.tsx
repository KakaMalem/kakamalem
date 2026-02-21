"use client";

import { useState } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  UnifiedMediaSelector,
  type MediaSelection,
} from "@/components/dashboard/media/unified-media-selector";
import { useEditorContext } from "@/lib/page-builder/editor-context";

interface ImagePickerFieldProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export function ImagePickerFieldRender({
  value,
  onChange,
  readOnly,
}: ImagePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const { tenantId } = useEditorContext();

  const handleSelect = (media: MediaSelection | null) => {
    if (media) {
      onChange(media.url);
    }
    setOpen(false);
  };

  if (value) {
    return (
      <div className="space-y-2">
        <div className="relative aspect-video overflow-hidden rounded-md border bg-muted">
          <Image
            src={value}
            alt="Selected image"
            fill
            className="object-cover"
            sizes="300px"
          />
          {!readOnly && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            className="w-full"
          >
            Change Image
          </Button>
        )}
        <UnifiedMediaSelector
          tenantId={tenantId}
          open={open}
          onOpenChange={setOpen}
          onSelect={handleSelect}
        />
      </div>
    );
  }

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={readOnly}
        className="flex h-24 w-full flex-col items-center justify-center gap-2 border-dashed"
      >
        <ImagePlus className="h-6 w-6 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Select Image</span>
      </Button>
      <UnifiedMediaSelector
        tenantId={tenantId}
        open={open}
        onOpenChange={setOpen}
        onSelect={handleSelect}
      />
    </div>
  );
}
