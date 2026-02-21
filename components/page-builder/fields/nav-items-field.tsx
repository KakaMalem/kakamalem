"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { NavItem } from "@/lib/theme/layout-types";

interface NavItemsFieldProps {
  label: string;
  value: NavItem[];
  onChange: (items: NavItem[]) => void;
}

export function NavItemsField({ label, value, onChange }: NavItemsFieldProps) {
  const addItem = () => {
    onChange([...value, { label: "", href: "" }]);
  };

  const updateItem = (index: number, field: keyof NavItem, val: string) => {
    const updated = value.map((item, i) =>
      i === index ? { ...item, [field]: val } : item
    );
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((item, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <div className="flex-1 space-y-1">
                <Input
                  placeholder="Label"
                  value={item.label}
                  onChange={(e) => updateItem(i, "label", e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="/about or https://..."
                  value={item.href}
                  onChange={(e) => updateItem(i, "href", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="mt-0.5 size-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeItem(i)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-xs"
        onClick={addItem}
      >
        <Plus className="size-3.5" />
        Add Link
      </Button>
    </div>
  );
}
