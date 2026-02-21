"use client";

import { Input } from "@/components/ui/input";

interface ColorFieldProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export function ColorFieldRender({
  value,
  onChange,
  readOnly,
}: ColorFieldProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-8 w-8 shrink-0 rounded-md border"
        style={{ backgroundColor: value || "transparent" }}
      />
      <input
        type="color"
        value={value || "#ffffff"}
        onChange={(e) => onChange(e.target.value)}
        disabled={readOnly}
        className="h-8 w-8 shrink-0 cursor-pointer rounded-md border-0 p-0"
      />
      <Input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#ffffff"
        disabled={readOnly}
        className="h-8 font-mono text-xs"
      />
    </div>
  );
}
