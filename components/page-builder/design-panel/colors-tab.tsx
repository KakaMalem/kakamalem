"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useDesignContext } from "@/lib/page-builder/design-context";
import { themePresets } from "@/lib/theme/presets";
import type { ExtendedColors } from "@/lib/theme/types";

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <div
          className="size-7 shrink-0 rounded-md border"
          style={{ backgroundColor: value || "transparent" }}
        />
        <input
          type="color"
          value={value || "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="size-7 shrink-0 cursor-pointer rounded-md border-0 p-0"
        />
        <Input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="oklch(...) or #hex"
          className="h-7 font-mono text-xs"
        />
      </div>
    </div>
  );
}

export function ColorsTab() {
  const { state, updateTheme } = useDesignContext();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const extended = state.theme.extendedColors || {};

  const updateExtended = (key: keyof ExtendedColors, value: string) => {
    updateTheme({
      extendedColors: { ...extended, [key]: value || undefined },
      presetName: null,
    });
  };

  return (
    <div className="space-y-5">
      {/* Presets */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Presets</Label>
        <div className="grid grid-cols-2 gap-2">
          {themePresets.map((preset) => (
            <button
              key={preset.name}
              onClick={() =>
                updateTheme({
                  ...preset.config,
                  extendedColors: undefined,
                })
              }
              className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors hover:bg-muted/50 ${
                state.theme.presetName === preset.name
                  ? "border-primary bg-primary/5"
                  : ""
              }`}
            >
              <div
                className="size-5 shrink-0 rounded-full border"
                style={{ backgroundColor: preset.config.primaryColor }}
              />
              <div>
                <p className="text-xs font-medium">{preset.label}</p>
                <p className="text-[10px] text-muted-foreground">
                  {preset.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Core Colors */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">Core Colors</Label>
        <ColorPicker
          label="Primary"
          value={state.theme.primaryColor}
          onChange={(v) => updateTheme({ primaryColor: v, presetName: null })}
        />
        <ColorPicker
          label="Secondary"
          value={state.theme.secondaryColor}
          onChange={(v) => updateTheme({ secondaryColor: v, presetName: null })}
        />
        <ColorPicker
          label="Accent"
          value={state.theme.accentColor}
          onChange={(v) => updateTheme({ accentColor: v, presetName: null })}
        />
      </div>

      {/* Advanced Colors */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted/50">
          Advanced Colors
          <ChevronDown
            className={`size-3.5 transition-transform ${
              advancedOpen ? "rotate-180" : ""
            }`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-3">
          <ColorPicker
            label="Background"
            value={extended.backgroundColor || "oklch(1 0 0)"}
            onChange={(v) => updateExtended("backgroundColor", v)}
          />
          <ColorPicker
            label="Text / Foreground"
            value={extended.foregroundColor || "oklch(0.145 0 0)"}
            onChange={(v) => updateExtended("foregroundColor", v)}
          />
          <ColorPicker
            label="Muted"
            value={extended.mutedColor || "oklch(0.97 0 0)"}
            onChange={(v) => updateExtended("mutedColor", v)}
          />
          <ColorPicker
            label="Muted Text"
            value={extended.mutedForegroundColor || "oklch(0.556 0 0)"}
            onChange={(v) => updateExtended("mutedForegroundColor", v)}
          />
          <ColorPicker
            label="Border"
            value={extended.borderColor || "oklch(0.922 0 0)"}
            onChange={(v) => updateExtended("borderColor", v)}
          />
          <ColorPicker
            label="Card"
            value={extended.cardColor || "oklch(1 0 0)"}
            onChange={(v) => updateExtended("cardColor", v)}
          />
          <ColorPicker
            label="Destructive"
            value={extended.destructiveColor || "oklch(0.577 0.245 27.325)"}
            onChange={(v) => updateExtended("destructiveColor", v)}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
