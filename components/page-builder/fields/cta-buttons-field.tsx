"use client";

import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CTAButton } from "@/lib/page-builder/types";

const MAX_BUTTONS = 3;

const styleOptions: { value: CTAButton["style"]; label: string }[] = [
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "outline", label: "Outline" },
];

interface CTAButtonsFieldProps {
  value: CTAButton[];
  onChange: (value: CTAButton[]) => void;
}

function CTAButtonsField({ value = [], onChange }: CTAButtonsFieldProps) {
  const handleAdd = () => {
    if (value.length >= MAX_BUTTONS) return;
    onChange([...value, { text: "", href: "", style: "primary" }]);
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleUpdate = (index: number, updates: Partial<CTAButton>) => {
    const updated = value.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    );
    onChange(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...value];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === value.length - 1) return;
    const updated = [...value];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {value.map((button, i) => (
        <div key={i} className="rounded-md border p-2.5">
          <div className="flex items-center gap-1.5">
            <span className="flex-1 truncate text-xs font-medium text-muted-foreground">
              Button {i + 1}
            </span>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-foreground"
                onClick={() => handleMoveUp(i)}
                disabled={i === 0}
              >
                <ChevronUp className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-foreground"
                onClick={() => handleMoveDown(i)}
                disabled={i === value.length - 1}
              >
                <ChevronDown className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-destructive hover:text-destructive"
                onClick={() => handleRemove(i)}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>

          <div className="mt-2 space-y-1.5">
            <div className="space-y-1">
              <Label className="text-xs">Text</Label>
              <Input
                value={button.text}
                onChange={(e) => handleUpdate(i, { text: e.target.value })}
                placeholder="Shop Now"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Link</Label>
              <Input
                value={button.href}
                onChange={(e) => handleUpdate(i, { href: e.target.value })}
                placeholder="/products or https://..."
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Style</Label>
              <select
                value={button.style}
                onChange={(e) =>
                  handleUpdate(i, {
                    style: e.target.value as CTAButton["style"],
                  })
                }
                className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {styleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ))}

      {value.length < MAX_BUTTONS && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="w-full gap-1.5 text-xs"
        >
          <Plus className="size-3.5" />
          Add Button
        </Button>
      )}
    </div>
  );
}

export function CTAButtonsFieldRender({
  value,
  onChange,
}: {
  value: CTAButton[];
  onChange: (v: CTAButton[]) => void;
}) {
  return <CTAButtonsField value={value} onChange={onChange} />;
}
