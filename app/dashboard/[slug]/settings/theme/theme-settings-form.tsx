"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateThemeConfig, updateCustomCss } from "@/lib/actions/stores";
import { getCssLengthInfo } from "@/lib/theme/css-sanitizer";
import { defaultThemeConfig } from "@/lib/theme/presets";
import { themePresets } from "@/lib/theme/presets";
import type { ThemeConfig, FontFamily } from "@/lib/theme/types";
import {
  fontFamilyOptions,
  fontFamilyLabels,
  borderRadiusOptions,
  borderRadiusLabels,
  buttonStyleOptions,
  buttonStyleLabels,
} from "@/lib/theme/types";

interface ThemeSettingsFormProps {
  storeId: string;
  storeSlug: string;
  initialConfig: ThemeConfig | null;
  customCss?: string;
  isPro?: boolean;
}

export function ThemeSettingsForm({
  storeId,
  storeSlug,
  initialConfig,
  customCss: initialCustomCss = "",
  isPro = false,
}: ThemeSettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isCssPending, startCssTransition] = useTransition();
  const [config, setConfig] = useState<ThemeConfig>(
    initialConfig ?? defaultThemeConfig
  );
  const [cssValue, setCssValue] = useState(initialCustomCss);
  const cssInfo = getCssLengthInfo(cssValue);

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateThemeConfig(storeId, config);
      if (result.success) {
        toast.success("Theme updated successfully");
      } else {
        toast.error(result.error?.message || "Failed to update theme");
      }
    });
  };

  const handleResetToDefault = () => {
    setConfig(defaultThemeConfig);
  };

  const applyPreset = (preset: (typeof themePresets)[number]) => {
    setConfig(preset.config);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Theme</h1>
          <p className="text-muted-foreground">
            Customize your store&apos;s visual appearance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleResetToDefault}>
            <RotateCcw className="mr-2 size-4" />
            Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Presets */}
      <Card>
        <CardHeader>
          <CardTitle>Presets</CardTitle>
          <CardDescription>
            Quick-start with a curated theme, then customize further.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {themePresets.map((preset) => {
              const isActive = config.presetName === preset.name;
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`relative rounded-lg border-2 p-3 text-left transition-all hover:border-primary/50 ${
                    isActive ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  {isActive && (
                    <div className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" />
                    </div>
                  )}
                  {/* Color swatches */}
                  <div className="mb-2 flex gap-1.5">
                    <div
                      className="size-6 rounded-full border"
                      style={{ backgroundColor: preset.config.primaryColor }}
                    />
                    <div
                      className="size-6 rounded-full border"
                      style={{ backgroundColor: preset.config.secondaryColor }}
                    />
                    <div
                      className="size-6 rounded-full border"
                      style={{ backgroundColor: preset.config.accentColor }}
                    />
                  </div>
                  <p className="text-sm font-medium">{preset.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader>
          <CardTitle>Colors</CardTitle>
          <CardDescription>
            Define your brand colors. Use OKLCH values for precision or hex
            codes for simplicity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary</Label>
              <div className="flex gap-2">
                <div
                  className="size-10 shrink-0 rounded-md border"
                  style={{ backgroundColor: config.primaryColor }}
                />
                <Input
                  id="primaryColor"
                  value={config.primaryColor}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      primaryColor: e.target.value,
                      presetName: null,
                    })
                  }
                  placeholder="oklch(0.55 0.15 250)"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Main buttons, links, and accents
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondaryColor">Secondary</Label>
              <div className="flex gap-2">
                <div
                  className="size-10 shrink-0 rounded-md border"
                  style={{ backgroundColor: config.secondaryColor }}
                />
                <Input
                  id="secondaryColor"
                  value={config.secondaryColor}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      secondaryColor: e.target.value,
                      presetName: null,
                    })
                  }
                  placeholder="oklch(0.97 0 0)"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Secondary buttons and backgrounds
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accentColor">Accent</Label>
              <div className="flex gap-2">
                <div
                  className="size-10 shrink-0 rounded-md border"
                  style={{ backgroundColor: config.accentColor }}
                />
                <Input
                  id="accentColor"
                  value={config.accentColor}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      accentColor: e.target.value,
                      presetName: null,
                    })
                  }
                  placeholder="oklch(0.97 0 0)"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Highlights and hover states
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Typography */}
      <Card>
        <CardHeader>
          <CardTitle>Typography</CardTitle>
          <CardDescription>Choose the fonts for your store.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Body Font</Label>
              <Select
                value={config.fontFamily}
                onValueChange={(val: FontFamily) =>
                  setConfig({ ...config, fontFamily: val, presetName: null })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fontFamilyOptions.map((font) => (
                    <SelectItem key={font} value={font}>
                      {fontFamilyLabels[font]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Heading Font (optional)</Label>
              <Select
                value={config.headingFontFamily ?? config.fontFamily}
                onValueChange={(val: FontFamily) =>
                  setConfig({
                    ...config,
                    headingFontFamily:
                      val === config.fontFamily ? undefined : val,
                    presetName: null,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fontFamilyOptions.map((font) => (
                    <SelectItem key={font} value={font}>
                      {fontFamilyLabels[font]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Leave as body font for a uniform look
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shape & Style */}
      <Card>
        <CardHeader>
          <CardTitle>Shape & Style</CardTitle>
          <CardDescription>
            Adjust border radius and button style for your store.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Border Radius */}
            <div className="space-y-3">
              <Label>Border Radius</Label>
              <div className="grid grid-cols-3 gap-2">
                {borderRadiusOptions.map((radius) => (
                  <button
                    key={radius}
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        borderRadius: radius,
                        presetName: null,
                      })
                    }
                    className={`flex flex-col items-center gap-1.5 rounded-md border-2 p-3 transition-all ${
                      config.borderRadius === radius
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div
                      className="size-8 border-2 border-foreground/30 bg-muted"
                      style={{
                        borderRadius:
                          radius === "none"
                            ? 0
                            : radius === "sm"
                              ? 4
                              : radius === "md"
                                ? 8
                                : radius === "lg"
                                  ? 12
                                  : radius === "xl"
                                    ? 16
                                    : 9999,
                      }}
                    />
                    <span className="text-xs">
                      {borderRadiusLabels[radius]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Button Style */}
            <div className="space-y-3">
              <Label>Button Style</Label>
              <div className="grid grid-cols-3 gap-2">
                {buttonStyleOptions.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        buttonStyle: style,
                        presetName: null,
                      })
                    }
                    className={`flex flex-col items-center gap-1.5 rounded-md border-2 p-3 transition-all ${
                      config.buttonStyle === style
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div
                      className="rounded-md px-3 py-1.5 text-xs font-medium"
                      style={
                        style === "solid"
                          ? {
                              backgroundColor: config.primaryColor,
                              color: "white",
                            }
                          : style === "outline"
                            ? {
                                border: `2px solid ${config.primaryColor}`,
                                color: config.primaryColor,
                              }
                            : {
                                backgroundColor: `color-mix(in oklch, ${config.primaryColor} 15%, transparent)`,
                                color: config.primaryColor,
                              }
                      }
                    >
                      Button
                    </div>
                    <span className="text-xs">{buttonStyleLabels[style]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            See how your theme looks. Save to apply to your live store.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-lg border p-6"
            style={
              {
                "--preview-primary": config.primaryColor,
                "--preview-secondary": config.secondaryColor,
                "--preview-accent": config.accentColor,
              } as React.CSSProperties
            }
          >
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Sample Store</h3>
              <p className="text-sm text-muted-foreground">
                This is how text and elements will look with your theme
                settings.
              </p>
              <div className="flex flex-wrap gap-2">
                <div
                  className="rounded-md px-4 py-2 text-sm font-medium text-white"
                  style={{
                    backgroundColor: config.primaryColor,
                    borderRadius:
                      config.borderRadius === "none"
                        ? 0
                        : config.borderRadius === "sm"
                          ? 4
                          : config.borderRadius === "md"
                            ? 8
                            : config.borderRadius === "lg"
                              ? 12
                              : config.borderRadius === "xl"
                                ? 16
                                : 9999,
                  }}
                >
                  Primary Button
                </div>
                <div
                  className="rounded-md border-2 px-4 py-2 text-sm font-medium"
                  style={{
                    borderColor: config.primaryColor,
                    color: config.primaryColor,
                    borderRadius:
                      config.borderRadius === "none"
                        ? 0
                        : config.borderRadius === "sm"
                          ? 4
                          : config.borderRadius === "md"
                            ? 8
                            : config.borderRadius === "lg"
                              ? 12
                              : config.borderRadius === "xl"
                                ? 16
                                : 9999,
                  }}
                >
                  Outline Button
                </div>
                <div
                  className="rounded-md px-4 py-2 text-sm font-medium"
                  style={{
                    backgroundColor: config.secondaryColor,
                    borderRadius:
                      config.borderRadius === "none"
                        ? 0
                        : config.borderRadius === "sm"
                          ? 4
                          : config.borderRadius === "md"
                            ? 8
                            : config.borderRadius === "lg"
                              ? 12
                              : config.borderRadius === "xl"
                                ? 16
                                : 9999,
                  }}
                >
                  Secondary Button
                </div>
              </div>
              <div className="flex gap-2">
                <div
                  className="h-16 flex-1 rounded-md"
                  style={{ backgroundColor: config.primaryColor }}
                />
                <div
                  className="h-16 flex-1 rounded-md"
                  style={{ backgroundColor: config.secondaryColor }}
                />
                <div
                  className="h-16 flex-1 rounded-md"
                  style={{ backgroundColor: config.accentColor }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom CSS (Pro Only) */}
      <Card>
        <CardHeader>
          <CardTitle>Custom CSS</CardTitle>
          <CardDescription>
            Add custom CSS to fine-tune your storefront styling beyond theme
            presets.{" "}
            {!isPro && (
              <span className="font-medium text-primary">
                Upgrade to Pro to unlock this feature.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="custom-css">CSS Code</Label>
            <Textarea
              id="custom-css"
              value={cssValue}
              onChange={(e) => setCssValue(e.target.value)}
              placeholder={
                isPro
                  ? ".my-store-header {\n  background: linear-gradient(...);\n}"
                  : "Custom CSS is available on the Pro plan"
              }
              className="min-h-50 font-mono text-sm"
              disabled={!isPro}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {cssInfo.length.toLocaleString()} /{" "}
                {(cssInfo.maxLength / 1024).toFixed(0)}KB
              </span>
              {cssInfo.isOverLimit && (
                <span className="text-destructive">Over limit</span>
              )}
            </div>
          </div>
          {isPro && (
            <Button
              variant="outline"
              onClick={() => {
                startCssTransition(async () => {
                  const result = await updateCustomCss(
                    storeId,
                    storeSlug,
                    cssValue
                  );
                  if (result.success) {
                    if (result.warnings && result.warnings.length > 0) {
                      toast.warning(
                        `CSS saved with warnings: ${result.warnings.join(", ")}`
                      );
                    } else {
                      toast.success("Custom CSS saved");
                    }
                  } else {
                    toast.error(
                      result.error?.message || "Failed to save custom CSS"
                    );
                  }
                });
              }}
              disabled={isCssPending || cssInfo.isOverLimit}
            >
              {isCssPending ? "Saving..." : "Save Custom CSS"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Sticky save bar for mobile */}
      <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background py-4 sm:hidden">
        <Button variant="outline" size="sm" onClick={handleResetToDefault}>
          Reset
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
