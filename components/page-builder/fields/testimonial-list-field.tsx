"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus, Trash2, ChevronDown, ChevronRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  UnifiedMediaSelector,
  type MediaSelection,
} from "@/components/dashboard/media/unified-media-selector";
import { useEditorContext } from "@/lib/page-builder/editor-context";

type Testimonial = {
  quote: string;
  authorName: string;
  authorRole: string;
  authorImageUrl: string;
  rating: number;
};

interface TestimonialListFieldProps {
  value: Testimonial[];
  onChange: (value: Testimonial[]) => void;
}

function TestimonialListField({
  value = [],
  onChange,
}: TestimonialListFieldProps) {
  const { tenantId } = useEditorContext();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(
    value.length === 0 ? null : 0
  );
  const [mediaOpenIndex, setMediaOpenIndex] = useState<number | null>(null);

  const handleAdd = () => {
    const newItem: Testimonial = {
      quote: "",
      authorName: "",
      authorRole: "",
      authorImageUrl: "",
      rating: 5,
    };
    const updated = [...value, newItem];
    onChange(updated);
    setExpandedIndex(updated.length - 1);
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
    if (expandedIndex === index) setExpandedIndex(null);
  };

  const handleUpdate = (index: number, updates: Partial<Testimonial>) => {
    const updated = [...value];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {value.map((item, i) => (
        <div key={i} className="rounded-md border">
          {/* Accordion header */}
          <button
            type="button"
            className="flex w-full items-center gap-2 p-3 text-left hover:bg-muted/50"
            onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
          >
            {expandedIndex === i ? (
              <ChevronDown className="size-4 shrink-0" />
            ) : (
              <ChevronRight className="size-4 shrink-0" />
            )}
            {item.authorImageUrl ? (
              <div className="relative size-6 shrink-0 overflow-hidden rounded-full">
                <Image
                  src={item.authorImageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="24px"
                />
              </div>
            ) : (
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs">
                {item.authorName?.charAt(0) || "?"}
              </div>
            )}
            <span className="flex-1 truncate text-sm font-medium">
              {item.authorName || "New Testimonial"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(i);
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </button>

          {/* Accordion content */}
          {expandedIndex === i && (
            <div className="space-y-3 border-t px-3 py-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Quote</Label>
                <Textarea
                  value={item.quote}
                  onChange={(e) => handleUpdate(i, { quote: e.target.value })}
                  placeholder="Customer's testimonial..."
                  rows={3}
                  className="text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={item.authorName}
                    onChange={(e) =>
                      handleUpdate(i, { authorName: e.target.value })
                    }
                    placeholder="John Doe"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Role</Label>
                  <Input
                    value={item.authorRole}
                    onChange={(e) =>
                      handleUpdate(i, { authorRole: e.target.value })
                    }
                    placeholder="CEO, Acme Corp"
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* Avatar */}
              <div className="space-y-1.5">
                <Label className="text-xs">Avatar</Label>
                <div className="flex items-center gap-2">
                  {item.authorImageUrl ? (
                    <div className="relative size-10 shrink-0 overflow-hidden rounded-full">
                      <Image
                        src={item.authorImageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    </div>
                  ) : (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm">
                      {item.authorName?.charAt(0) || "?"}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMediaOpenIndex(i)}
                    className="h-7 text-xs"
                  >
                    {item.authorImageUrl ? "Change" : "Upload"}
                  </Button>
                  {item.authorImageUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUpdate(i, { authorImageUrl: "" })}
                      className="h-7 text-xs text-destructive"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              {/* Rating */}
              <div className="space-y-1.5">
                <Label className="text-xs">Rating</Label>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }, (_, starIdx) => (
                    <button
                      key={starIdx}
                      type="button"
                      onClick={() => handleUpdate(i, { rating: starIdx + 1 })}
                      className="p-0.5"
                    >
                      <Star
                        className={`size-5 ${
                          starIdx < item.rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "fill-muted text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Media selector for this testimonial */}
              {mediaOpenIndex === i && (
                <UnifiedMediaSelector
                  tenantId={tenantId}
                  open={true}
                  onOpenChange={(open) => {
                    if (!open) setMediaOpenIndex(null);
                  }}
                  onSelect={(media: MediaSelection | null) => {
                    if (media) {
                      handleUpdate(i, { authorImageUrl: media.url });
                    }
                    setMediaOpenIndex(null);
                  }}
                />
              )}
            </div>
          )}
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={handleAdd}
        className="w-full"
      >
        <Plus className="mr-2 size-4" />
        Add Testimonial
      </Button>
    </div>
  );
}

export function TestimonialListFieldRender(props: {
  value: Testimonial[];
  onChange: (value: Testimonial[]) => void;
}) {
  return <TestimonialListField value={props.value} onChange={props.onChange} />;
}
