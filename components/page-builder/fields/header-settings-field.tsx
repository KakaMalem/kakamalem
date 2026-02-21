"use client";

import { Layout, AlignCenter, Minus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "./image-upload";
import { NavItemsField } from "./nav-items-field";
import type { HeaderConfig, HeaderStyle } from "@/lib/theme/layout-types";

const headerStyles: {
  value: HeaderStyle;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "default",
    label: "Default",
    description: "Logo left, search center, actions right",
    icon: Layout,
  },
  {
    value: "centered",
    label: "Centered",
    description: "Logo centered, search below",
    icon: AlignCenter,
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Compact row, logo left, actions right",
    icon: Minus,
  },
];

const displayOptions: {
  value: HeaderConfig["headerDisplay"];
  label: string;
}[] = [
  { value: "logo_and_name", label: "Logo + Name" },
  { value: "logo_only", label: "Logo Only" },
  { value: "name_only", label: "Name Only" },
];

const colorSchemes: {
  value: HeaderConfig["colorScheme"];
  label: string;
}[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "primary", label: "Primary" },
  { value: "transparent", label: "Transparent" },
  { value: "custom", label: "Custom" },
];

const paddingOptions: {
  value: HeaderConfig["padding"];
  label: string;
}[] = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Normal" },
  { value: "spacious", label: "Spacious" },
];

const logoSizes: {
  value: HeaderConfig["logoSize"];
  label: string;
}[] = [
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
];

/**
 * Custom Puck field for the StoreHeader section.
 * Reads/writes to Puck props via onChange.
 */
export function HeaderSettingsFieldRender({
  value,
  onChange,
}: {
  value: HeaderConfig;
  onChange: (config: HeaderConfig) => void;
}) {
  const update = (partial: Partial<HeaderConfig>) => {
    onChange({ ...value, ...partial });
  };

  return (
    <div className="space-y-5">
      {/* Logo */}
      <ImageUpload
        label="Logo"
        description="Upload logo (max 2MB)"
        value={value.logoUrl}
        onChange={(url) => update({ logoUrl: url })}
        maxSizeKb={2048}
        accept="image/*"
      />

      {/* Favicon */}
      <ImageUpload
        label="Favicon"
        description="Upload favicon (max 512KB)"
        value={value.faviconUrl}
        onChange={(url) => update({ faviconUrl: url })}
        maxSizeKb={512}
        accept="image/png,image/x-icon,image/svg+xml"
      />

      {/* Header Style */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Header Style</Label>
        <div className="grid grid-cols-1 gap-1.5">
          {headerStyles.map((style) => {
            const Icon = style.icon;
            return (
              <button
                key={style.value}
                onClick={() => update({ headerStyle: style.value })}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
                  value.headerStyle === style.value
                    ? "border-primary bg-primary/5"
                    : ""
                }`}
              >
                <Icon className="size-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{style.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {style.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Header Display */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Header Display</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {displayOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => update({ headerDisplay: option.value })}
              disabled={option.value !== "name_only" && !value.logoUrl}
              className={`rounded-md border px-2 py-2 text-center text-xs transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40 ${
                value.headerDisplay === option.value
                  ? "border-primary bg-primary/5"
                  : ""
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {!value.logoUrl && (
          <p className="text-[10px] text-muted-foreground">
            Upload a logo above to enable logo display options
          </p>
        )}
      </div>

      {/* Logo Size */}
      {value.logoUrl && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">Logo Size</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {logoSizes.map((size) => (
              <button
                key={size.value}
                onClick={() => update({ logoSize: size.value })}
                className={`rounded-md border px-2 py-2 text-center text-xs transition-colors hover:bg-muted/50 ${
                  value.logoSize === size.value
                    ? "border-primary bg-primary/5"
                    : ""
                }`}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feature Toggles */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">Features</Label>
        <ToggleRow
          label="Search Bar"
          description="Show search in the header"
          checked={value.showSearchBar}
          onCheckedChange={(checked) => update({ showSearchBar: checked })}
        />
        <ToggleRow
          label="Categories Bar"
          description="Show category navigation below header"
          checked={value.showCategoriesBar}
          onCheckedChange={(checked) => update({ showCategoriesBar: checked })}
        />
        <ToggleRow
          label="Sticky Header"
          description="Header stays fixed at the top"
          checked={value.stickyHeader}
          onCheckedChange={(checked) => update({ stickyHeader: checked })}
        />
        <ToggleRow
          label="Bottom Border"
          description="Show border below header"
          checked={value.borderBottom}
          onCheckedChange={(checked) => update({ borderBottom: checked })}
        />
      </div>

      {/* Color Scheme */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Color Scheme</Label>
        <div className="grid grid-cols-3 gap-1.5">
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

      {/* Custom Colors (only when custom scheme selected) */}
      {value.colorScheme === "custom" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium">Background</Label>
            <input
              type="color"
              value={value.backgroundColor || "#ffffff"}
              onChange={(e) => update({ backgroundColor: e.target.value })}
              className="size-6 cursor-pointer rounded border"
            />
            <span className="text-xs text-muted-foreground">
              {value.backgroundColor || "#ffffff"}
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

      {/* Nav Items */}
      <NavItemsField
        label="Navigation Links"
        value={value.navItems}
        onChange={(items) => update({ navItems: items })}
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
