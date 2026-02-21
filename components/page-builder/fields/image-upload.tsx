"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useEditorContext } from "@/lib/page-builder/editor-context";

interface ImageUploadProps {
  label: string;
  description: string;
  value: string;
  onChange: (url: string) => void;
  maxSizeKb: number;
  accept: string;
}

export function ImageUpload({
  label,
  description,
  value,
  onChange,
  maxSizeKb,
  accept,
}: ImageUploadProps) {
  const { tenantId } = useEditorContext();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (file.size > maxSizeKb * 1024) {
      toast.error(`File too large. Max ${maxSizeKb}KB.`);
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tenantId", tenantId);
      formData.append("folder", "logos");
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChange(data.url);
      toast.success(`${label} uploaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border p-2">
          <div className="relative size-10 shrink-0 overflow-hidden rounded bg-muted">
            <Image
              src={value}
              alt={label}
              fill
              className="object-contain"
              sizes="40px"
            />
          </div>
          <p className="flex-1 truncate text-xs text-muted-foreground">
            Uploaded
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
            className="size-7 p-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/30 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {uploading ? "Uploading..." : description}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
