"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContentCard } from "@/lib/page-builder/types";

const MAX_CARDS = 8;

const aspectRatioOptions: {
  value: ContentCard["aspectRatio"];
  label: string;
}[] = [
  { value: "4/5", label: "4:5 (Portrait)" },
  { value: "3/4", label: "3:4 (Tall)" },
  { value: "1/1", label: "1:1 (Square)" },
  { value: "16/9", label: "16:9 (Wide)" },
];

const defaultCard: ContentCard = {
  imageUrl: "",
  mobileImageUrl: "",
  title: "",
  subtitle: "",
  href: "",
  ctaText: "",
  aspectRatio: "4/5",
};

interface CardListFieldProps {
  value: ContentCard[];
  onChange: (value: ContentCard[]) => void;
}

function CardListField({ value = [], onChange }: CardListFieldProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(
    value.length === 0 ? null : 0
  );

  const handleAdd = () => {
    if (value.length >= MAX_CARDS) return;
    const updated = [...value, { ...defaultCard }];
    onChange(updated);
    setExpandedIndex(updated.length - 1);
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
    if (expandedIndex === index) setExpandedIndex(null);
  };

  const handleUpdate = (index: number, updates: Partial<ContentCard>) => {
    const updated = value.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    );
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {value.map((card, i) => (
        <div key={i} className="rounded-md border">
          {/* Accordion header */}
          <button
            type="button"
            className="flex w-full items-center gap-2 p-2.5 text-left hover:bg-muted/50"
            onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
          >
            {expandedIndex === i ? (
              <ChevronDown className="size-3.5 shrink-0" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0" />
            )}
            <span className="flex-1 truncate text-xs font-medium">
              {card.title || `Card ${i + 1}`}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(i);
              }}
            >
              <Trash2 className="size-3" />
            </Button>
          </button>

          {/* Accordion content */}
          {expandedIndex === i && (
            <div className="space-y-2 border-t px-2.5 py-2.5">
              <div className="space-y-1">
                <Label className="text-xs">Image URL</Label>
                <Input
                  value={card.imageUrl}
                  onChange={(e) =>
                    handleUpdate(i, { imageUrl: e.target.value })
                  }
                  placeholder="https://... or /uploads/..."
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mobile Image URL</Label>
                <Input
                  value={card.mobileImageUrl}
                  onChange={(e) =>
                    handleUpdate(i, { mobileImageUrl: e.target.value })
                  }
                  placeholder="Optional mobile image"
                  className="h-7 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Title</Label>
                  <Input
                    value={card.title}
                    onChange={(e) => handleUpdate(i, { title: e.target.value })}
                    placeholder="Card title"
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Subtitle</Label>
                  <Input
                    value={card.subtitle}
                    onChange={(e) =>
                      handleUpdate(i, { subtitle: e.target.value })
                    }
                    placeholder="Short subtitle"
                    className="h-7 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Link</Label>
                  <Input
                    value={card.href}
                    onChange={(e) => handleUpdate(i, { href: e.target.value })}
                    placeholder="/products or https://..."
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CTA Text</Label>
                  <Input
                    value={card.ctaText}
                    onChange={(e) =>
                      handleUpdate(i, { ctaText: e.target.value })
                    }
                    placeholder="Shop Now"
                    className="h-7 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Aspect Ratio</Label>
                <select
                  value={card.aspectRatio}
                  onChange={(e) =>
                    handleUpdate(i, {
                      aspectRatio: e.target.value as ContentCard["aspectRatio"],
                    })
                  }
                  className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {aspectRatioOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      ))}

      {value.length < MAX_CARDS && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="w-full gap-1.5 text-xs"
        >
          <Plus className="size-3.5" />
          Add Card
        </Button>
      )}
    </div>
  );
}

export function CardListFieldRender({
  value,
  onChange,
}: {
  value: ContentCard[];
  onChange: (v: ContentCard[]) => void;
}) {
  return <CardListField value={value} onChange={onChange} />;
}
