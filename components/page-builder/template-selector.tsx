"use client";

import { X, LayoutTemplate, Plus } from "lucide-react";
import { pageTemplates } from "@/lib/page-builder/templates";
import type { PuckPageData } from "@/lib/page-builder/types";

interface TemplateSelectorProps {
  onSelect: (data: PuckPageData) => void;
  onClose: () => void;
  hasExistingContent: boolean;
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  General: "Versatile layouts for most stores",
  Commerce: "Optimised for product sales",
  Services: "For service-based businesses",
  Catalog: "Browse-only, order via phone or WhatsApp",
};

export function TemplateSelector({
  onSelect,
  onClose,
  hasExistingContent,
}: TemplateSelectorProps) {
  const handleSelect = (data: PuckPageData) => {
    if (
      hasExistingContent &&
      !confirm("This will replace your current content. Continue?")
    ) {
      return;
    }
    onSelect(data);
  };

  // Group by category and preserve insertion order
  const grouped = pageTemplates.reduce(
    (acc, t) => {
      if (!acc[t.category]) acc[t.category] = [];
      acc[t.category].push(t);
      return acc;
    },
    {} as Record<string, typeof pageTemplates>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-xl bg-background shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <LayoutTemplate className="size-5 text-primary" />
            <div>
              <h2 className="text-base font-semibold">Choose a Template</h2>
              <p className="text-xs text-muted-foreground">
                Designed for Afghan merchants — customise after selecting.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Templates */}
        <div className="overflow-y-auto p-5 space-y-6">
          {/* Start from scratch */}
          <button
            onClick={onClose}
            className="flex w-full items-center gap-4 rounded-lg border-2 border-dashed p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Plus className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm">Start from Scratch</p>
              <p className="text-xs text-muted-foreground">
                Empty canvas — build exactly what you want
              </p>
            </div>
          </button>

          {/* Grouped templates */}
          {Object.entries(grouped).map(([category, templates]) => (
            <div key={category}>
              <div className="mb-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {category}
                </h3>
                {CATEGORY_DESCRIPTIONS[category] && (
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                    {CATEGORY_DESCRIPTIONS[category]}
                  </p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {templates.map((template) => {
                  // Filter out StoreHeader/StoreFooter from the section tags
                  const sectionTags = template.data.content
                    .filter(
                      (s) =>
                        s.type !== "StoreHeader" &&
                        s.type !== "StoreFooter" &&
                        s.type !== "Spacer"
                    )
                    .map((s) => s.type);

                  return (
                    <button
                      key={template.id}
                      onClick={() => handleSelect(template.data)}
                      className="group flex flex-col rounded-lg border text-left transition-all hover:border-primary/60 hover:shadow-md overflow-hidden"
                    >
                      {/* Colour bar */}
                      <div
                        className="h-1.5 w-full"
                        style={{
                          backgroundColor:
                            template.previewColor ?? "#e2e8f0",
                        }}
                      />
                      <div className="p-4 flex flex-col gap-2">
                        <p className="font-medium text-sm leading-tight">
                          {template.name}
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {template.description}
                        </p>
                        {/* Section tags */}
                        <div className="mt-1 flex flex-wrap gap-1">
                          {sectionTags.map((type, i) => (
                            <span
                              key={i}
                              className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                            >
                              {type
                                .replace(/([A-Z])/g, " $1")
                                .trim()
                                .replace("Product Grid", "Grid")
                                .replace("Product Carousel", "Carousel")
                                .replace("Featured Categories", "Categories")}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
