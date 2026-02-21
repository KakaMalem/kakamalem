"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { NavItemsField } from "./nav-items-field";
import type { FooterConfig, FooterColumn } from "@/lib/theme/layout-types";

const footerStyles: {
  value: FooterConfig["footerStyle"];
  label: string;
  description: string;
}[] = [
  {
    value: "standard",
    label: "Standard",
    description: "Multi-column grid layout",
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Single row — brand, links, copyright",
  },
  {
    value: "centered",
    label: "Centered",
    description: "Stacked, everything centered",
  },
];

const colorSchemes: {
  value: FooterConfig["colorScheme"];
  label: string;
}[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "primary", label: "Primary" },
  { value: "custom", label: "Custom" },
];

const paddingOptions: {
  value: FooterConfig["padding"];
  label: string;
}[] = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Normal" },
  { value: "spacious", label: "Spacious" },
];

/**
 * Custom Puck field for the StoreFooter section.
 * Reads/writes to Puck props via onChange.
 */
export function FooterSettingsFieldRender({
  value,
  onChange,
}: {
  value: FooterConfig;
  onChange: (config: FooterConfig) => void;
}) {
  const update = (partial: Partial<FooterConfig>) => {
    onChange({ ...value, ...partial });
  };

  return (
    <div className="space-y-5">
      {/* Footer Style */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Footer Style</Label>
        <div className="grid grid-cols-1 gap-1.5">
          {footerStyles.map((style) => (
            <button
              key={style.value}
              onClick={() => update({ footerStyle: style.value })}
              className={`flex flex-col gap-0.5 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
                value.footerStyle === style.value
                  ? "border-primary bg-primary/5"
                  : ""
              }`}
            >
              <p className="text-sm font-medium">{style.label}</p>
              <p className="text-xs text-muted-foreground">
                {style.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Section Toggles */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">Footer Sections</Label>
        <ToggleRow
          label="Quick Links"
          description="Links to products, categories, and policies"
          checked={value.showQuickLinks}
          onCheckedChange={(checked) => update({ showQuickLinks: checked })}
        />
        <ToggleRow
          label="Categories"
          description="Product category links for navigation"
          checked={value.showCategories}
          onCheckedChange={(checked) => update({ showCategories: checked })}
        />
        <ToggleRow
          label="Contact & Social"
          description="Contact info and social media links"
          checked={value.showContact}
          onCheckedChange={(checked) => update({ showContact: checked })}
        />
        <ToggleRow
          label="Social Links"
          description="Show social media icons"
          checked={value.showSocialLinks}
          onCheckedChange={(checked) => update({ showSocialLinks: checked })}
        />
        <ToggleRow
          label="Newsletter"
          description="Email signup section"
          checked={value.showNewsletter}
          onCheckedChange={(checked) => update({ showNewsletter: checked })}
        />
      </div>

      {/* Color Scheme */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Color Scheme</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {colorSchemes.map((scheme) => (
            <button
              key={scheme.value}
              onClick={() => update({ colorScheme: scheme.value })}
              className={`rounded-md border px-2 py-2 text-center text-xs transition-colors hover:bg-muted/50 ${
                value.colorScheme === scheme.value
                  ? "border-primary bg-primary/5"
                  : ""
              }`}
            >
              {scheme.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Colors */}
      {value.colorScheme === "custom" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium">Background</Label>
            <input
              type="color"
              value={value.backgroundColor || "#f5f5f5"}
              onChange={(e) => update({ backgroundColor: e.target.value })}
              className="size-6 cursor-pointer rounded border"
            />
            <span className="text-xs text-muted-foreground">
              {value.backgroundColor || "#f5f5f5"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium">Text</Label>
            <input
              type="color"
              value={value.textColor || "#000000"}
              onChange={(e) => update({ textColor: e.target.value })}
              className="size-6 cursor-pointer rounded border"
            />
            <span className="text-xs text-muted-foreground">
              {value.textColor || "#000000"}
            </span>
          </div>
        </div>
      )}

      {/* Padding */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Padding</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {paddingOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => update({ padding: option.value })}
              className={`rounded-md border px-2 py-2 text-center text-xs transition-colors hover:bg-muted/50 ${
                value.padding === option.value
                  ? "border-primary bg-primary/5"
                  : ""
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Copyright Text */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Copyright Text</Label>
        <Input
          placeholder="Leave empty for default"
          value={value.copyrightText}
          onChange={(e) => update({ copyrightText: e.target.value })}
          className="h-8 text-xs"
        />
        <p className="text-[10px] text-muted-foreground">
          Default: &quot;&copy; {new Date().getFullYear()} StoreName. All rights
          reserved.&quot;
        </p>
      </div>

      {/* Custom Columns */}
      <CustomColumnsEditor
        columns={value.customColumns}
        onChange={(cols) => update({ customColumns: cols })}
      />
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function CustomColumnsEditor({
  columns = [],
  onChange,
}: {
  columns: FooterColumn[];
  onChange: (columns: FooterColumn[]) => void;
}) {
  const addColumn = () => {
    onChange([...columns, { title: "", links: [] }]);
  };

  const updateColumnTitle = (index: number, title: string) => {
    const updated = columns.map((col, i) =>
      i === index ? { ...col, title } : col
    );
    onChange(updated);
  };

  const updateColumnLinks = (index: number, links: FooterColumn["links"]) => {
    const updated = columns.map((col, i) =>
      i === index ? { ...col, links } : col
    );
    onChange(updated);
  };

  const removeColumn = (index: number) => {
    onChange(columns.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">Custom Columns</Label>
      <p className="text-[10px] text-muted-foreground">
        Add custom link columns to the footer
      </p>

      {columns.map((col, i) => (
        <div key={i} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center gap-1.5">
            <Input
              placeholder="Column Title"
              value={col.title}
              onChange={(e) => updateColumnTitle(i, e.target.value)}
              className="h-8 text-xs"
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeColumn(i)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
          <NavItemsField
            label="Links"
            value={col.links}
            onChange={(links) => updateColumnLinks(i, links)}
          />
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-xs"
        onClick={addColumn}
      >
        <Plus className="size-3.5" />
        Add Column
      </Button>
    </div>
  );
}
