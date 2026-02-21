"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateLayoutConfig } from "@/lib/actions/stores";
import {
  defaultLayoutConfig,
  type HeaderStyle,
  type LayoutConfig,
} from "@/lib/theme/layout-types";
import { cn } from "@/lib/utils";

interface LayoutSettingsFormProps {
  storeId: string;
  storeSlug: string;
  initialConfig: LayoutConfig | null;
}

const headerStyleOptions: {
  value: HeaderStyle;
  label: string;
  description: string;
}[] = [
  {
    value: "default",
    label: "Default",
    description: "Logo left, search center, actions right",
  },
  {
    value: "centered",
    label: "Centered",
    description: "Logo centered on top, search and actions below",
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Compact row with logo left and actions right",
  },
];

export function LayoutSettingsForm({
  storeId,
  storeSlug,
  initialConfig,
}: LayoutSettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [config, setConfig] = useState<LayoutConfig>(
    initialConfig ?? defaultLayoutConfig
  );

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateLayoutConfig(storeId, config);
      if (result.success) {
        toast.success("Layout updated successfully");
      } else {
        toast.error(result.error?.message || "Failed to update layout");
      }
    });
  };

  const handleReset = () => {
    setConfig(defaultLayoutConfig);
  };

  return (
    <div className="space-y-6">
      {/* Header Style */}
      <Card>
        <CardHeader>
          <CardTitle>Header Style</CardTitle>
          <CardDescription>
            Choose how your store header is laid out
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {headerStyleOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setConfig((c) => ({
                    ...c,
                    header: { ...c.header, headerStyle: option.value },
                  }))
                }
                className={cn(
                  "rounded-lg border-2 p-4 text-left transition-colors",
                  config.header.headerStyle === option.value
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                )}
              >
                {/* Visual preview */}
                <div className="mb-3 rounded border bg-muted/50 p-2">
                  {option.value === "default" && (
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-8 rounded bg-foreground/20" />
                      <div className="mx-auto h-3 w-16 rounded bg-foreground/10" />
                      <div className="flex gap-1">
                        <div className="size-3 rounded bg-foreground/15" />
                        <div className="size-3 rounded bg-foreground/15" />
                      </div>
                    </div>
                  )}
                  {option.value === "centered" && (
                    <div className="space-y-1.5">
                      <div className="mx-auto h-3 w-12 rounded bg-foreground/20" />
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-2.5 w-14 rounded bg-foreground/10" />
                        <div className="flex gap-1">
                          <div className="size-2.5 rounded bg-foreground/15" />
                          <div className="size-2.5 rounded bg-foreground/15" />
                        </div>
                      </div>
                    </div>
                  )}
                  {option.value === "minimal" && (
                    <div className="flex items-center justify-between">
                      <div className="h-3 w-8 rounded bg-foreground/20" />
                      <div className="flex gap-1.5">
                        <div className="size-3 rounded bg-foreground/15" />
                        <div className="size-3 rounded bg-foreground/15" />
                        <div className="size-3 rounded bg-foreground/15" />
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-sm font-medium">{option.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {option.description}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <Card>
        <CardHeader>
          <CardTitle>Navigation</CardTitle>
          <CardDescription>
            Control search bar and categories navigation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="showSearchBar">Search Bar</Label>
              <p className="text-xs text-muted-foreground">
                Show the search bar in the header
              </p>
            </div>
            <Switch
              id="showSearchBar"
              checked={config.header.showSearchBar}
              onCheckedChange={(checked) =>
                setConfig((c) => ({
                  ...c,
                  header: { ...c.header, showSearchBar: checked },
                }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="showCategoriesBar">Categories Bar</Label>
              <p className="text-xs text-muted-foreground">
                Show the category navigation bar below the header
              </p>
            </div>
            <Switch
              id="showCategoriesBar"
              checked={config.header.showCategoriesBar}
              onCheckedChange={(checked) =>
                setConfig((c) => ({
                  ...c,
                  header: { ...c.header, showCategoriesBar: checked },
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <Card>
        <CardHeader>
          <CardTitle>Footer Sections</CardTitle>
          <CardDescription>
            Choose which sections to show in your store footer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="showQuickLinks">Quick Links</Label>
              <p className="text-xs text-muted-foreground">
                Links to products, categories, and policies
              </p>
            </div>
            <Switch
              id="showQuickLinks"
              checked={config.footer.showQuickLinks}
              onCheckedChange={(checked) =>
                setConfig((c) => ({
                  ...c,
                  footer: { ...c.footer, showQuickLinks: checked },
                }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="showCategories">Categories</Label>
              <p className="text-xs text-muted-foreground">
                Product category links in the footer
              </p>
            </div>
            <Switch
              id="showCategories"
              checked={config.footer.showCategories}
              onCheckedChange={(checked) =>
                setConfig((c) => ({
                  ...c,
                  footer: { ...c.footer, showCategories: checked },
                }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="showContact">Contact & Social</Label>
              <p className="text-xs text-muted-foreground">
                Contact information and social media links
              </p>
            </div>
            <Switch
              id="showContact"
              checked={config.footer.showContact}
              onCheckedChange={(checked) =>
                setConfig((c) => ({
                  ...c,
                  footer: { ...c.footer, showContact: checked },
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="mr-2 size-4" />
          Reset to Default
        </Button>
        <a
          href={`/store/${storeSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          Preview store
        </a>
      </div>
    </div>
  );
}
