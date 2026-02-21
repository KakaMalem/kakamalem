"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Plus, Trash2, GripVertical, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  UnifiedMediaSelector,
  type MediaSelection,
} from "@/components/dashboard/media/unified-media-selector";
import { useEditorContext } from "@/lib/page-builder/editor-context";

type GalleryImage = {
  url: string;
  alt: string;
  linkUrl?: string;
};

interface MultiImagePickerFieldProps {
  value: GalleryImage[];
  onChange: (value: GalleryImage[]) => void;
}

function MultiImagePickerField({
  value = [],
  onChange,
}: MultiImagePickerFieldProps) {
  const { tenantId } = useEditorContext();
  const [mediaOpen, setMediaOpen] = useState(false);
  const [editingLinkIndex, setEditingLinkIndex] = useState<number | null>(null);

  const handleAdd = useCallback(
    (media: MediaSelection | null) => {
      if (!media) return;
      onChange([
        ...value,
        { url: media.url, alt: media.altText || "", linkUrl: "" },
      ]);
      setMediaOpen(false);
    },
    [value, onChange]
  );

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleUpdate = (index: number, updates: Partial<GalleryImage>) => {
    const updated = [...value];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {/* Image list */}
      {value.map((img, i) => (
        <div key={i} className="flex items-start gap-2 rounded-md border p-2">
          <GripVertical className="mt-2 size-4 shrink-0 text-muted-foreground" />
          <div className="relative size-16 shrink-0 overflow-hidden rounded-md">
            {img.url ? (
              <Image
                src={img.url}
                alt={img.alt || ""}
                fill
                className="object-cover"
                sizes="64px"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-muted text-xs text-muted-foreground">
                No img
              </div>
            )}
          </div>
          <div className="flex-1 space-y-1.5">
            <Input
              value={img.alt}
              onChange={(e) => handleUpdate(i, { alt: e.target.value })}
              placeholder="Alt text"
              className="h-7 text-xs"
            />
            {editingLinkIndex === i ? (
              <div className="flex gap-1">
                <Input
                  value={img.linkUrl || ""}
                  onChange={(e) => handleUpdate(i, { linkUrl: e.target.value })}
                  placeholder="Link URL (optional)"
                  className="h-7 text-xs"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2"
                  onClick={() => setEditingLinkIndex(null)}
                >
                  Done
                </Button>
              </div>
            ) : (
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setEditingLinkIndex(i)}
              >
                <LinkIcon className="size-3" />
                {img.linkUrl ? "Edit link" : "Add link"}
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="size-7 shrink-0 p-0 text-destructive hover:text-destructive"
            onClick={() => handleRemove(i)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}

      {/* Add button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setMediaOpen(true)}
        className="w-full"
      >
        <Plus className="mr-2 size-4" />
        Add Image
      </Button>

      {/* Media selector */}
      <UnifiedMediaSelector
        tenantId={tenantId}
        open={mediaOpen}
        onOpenChange={setMediaOpen}
        onSelect={handleAdd}
      />
    </div>
  );
}

/**
 * Puck field render adapter.
 * Puck passes { value, onChange } to custom field renders.
 */
export function MultiImagePickerFieldRender(props: {
  value: GalleryImage[];
  onChange: (value: GalleryImage[]) => void;
}) {
  return (
    <MultiImagePickerField value={props.value} onChange={props.onChange} />
  );
}
