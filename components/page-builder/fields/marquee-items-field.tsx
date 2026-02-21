"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MarqueeItem } from "@/lib/page-builder/types";

const MAX_ITEMS = 10;

const iconOptions: { value: MarqueeItem["icon"]; label: string }[] = [
  { value: "none", label: "None" },
  { value: "truck", label: "Truck (Shipping)" },
  { value: "refresh", label: "Refresh (Returns)" },
  { value: "clock", label: "Clock (Time)" },
  { value: "shield", label: "Shield (Security)" },
  { value: "star", label: "Star (Rating)" },
  { value: "gift", label: "Gift (Promo)" },
  { value: "tag", label: "Tag (Sale)" },
  { value: "heart", label: "Heart (Favorite)" },
];

interface MarqueeItemsFieldProps {
  value: MarqueeItem[];
  onChange: (value: MarqueeItem[]) => void;
}

function MarqueeItemsField({ value = [], onChange }: MarqueeItemsFieldProps) {
  const handleAdd = () => {
    if (value.length >= MAX_ITEMS) return;
    onChange([...value, { text: "", icon: "none", href: "" }]);
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleUpdate = (index: number, updates: Partial<MarqueeItem>) => {
    const updated = value.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    );
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {value.map((item, i) => (
        <div key={i} className="rounded-md border p-2">
          <div className="flex items-start gap-1.5">
            <div className="flex-1 space-y-1.5">
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">
                  Text
                </Label>
                <Input
                  value={item.text}
                  onChange={(e) => handleUpdate(i, { text: e.target.value })}
                  placeholder="FREE SHIPPING OVER 2000 AFN"
                  className="h-7 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground">
                    Icon
                  </Label>
                  <select
                    value={item.icon}
                    onChange={(e) =>
                      handleUpdate(i, {
                        icon: e.target.value as MarqueeItem["icon"],
                      })
                    }
                    className="h-7 w-full rounded-md border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {iconOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground">
                    Link (optional)
                  </Label>
                  <Input
                    value={item.href}
                    onChange={(e) => handleUpdate(i, { href: e.target.value })}
                    placeholder="/shipping"
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="mt-4 size-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => handleRemove(i)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      ))}

      {value.length < MAX_ITEMS && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="w-full gap-1.5 text-xs"
        >
          <Plus className="size-3.5" />
          Add Item
        </Button>
      )}

      {value.length === 0 && (
        <p className="py-2 text-center text-xs text-muted-foreground">
          No items yet. Add items to display in the marquee bar.
        </p>
      )}
    </div>
  );
}

export function MarqueeItemsFieldRender({
  value,
  onChange,
}: {
  value: MarqueeItem[];
  onChange: (v: MarqueeItem[]) => void;
}) {
  return <MarqueeItemsField value={value} onChange={onChange} />;
}
