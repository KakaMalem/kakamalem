"use client";

import { X, LayoutTemplate } from "lucide-react";
import { pageTemplates } from "@/lib/page-builder/templates";
import type { PuckPageData } from "@/lib/page-builder/types";

interface TemplateSelectorProps {
  onSelect: (data: PuckPageData) => void;
  onClose: () => void;
  hasExistingContent: boolean;
}

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

  // Group templates by category
  const grouped = pageTemplates.reduce(
    (acc, t) => {
      if (!acc[t.category]) acc[t.category] = [];
      acc[t.category].push(t);
      return acc;
    },
    {} as Record<string, typeof pageTemplates>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-2xl rounded-xl bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="size-5" />
            <h2 className="text-lg font-semibold">Choose a Template</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        {/* Templates */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {/* Start from scratch */}
          <button
            onClick={onClose}
            className="mb-6 flex w-full items-center gap-4 rounded-lg border-2 border-dashed p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/50"
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
              <span className="text-2xl">+</span>
            </div>
            <div>
              <p className="font-medium">Start from Scratch</p>
              <p className="text-sm text-muted-foreground">
                Build your page with an empty canvas
              </p>
            </div>
          </button>

          {/* Grouped templates */}
          {Object.entries(grouped).map(([category, templates]) => (
            <div key={category} className="mb-6">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {category}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelect(template.data)}
                    className="flex flex-col gap-2 rounded-lg border p-4 text-left transition-all hover:border-primary/50 hover:bg-muted/30 hover:shadow-sm"
                  >
                    <p className="font-medium">{template.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {template.description}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {template.data.content.map((item, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          {item.type}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
