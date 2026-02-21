"use client";

import { Label } from "@/components/ui/label";
import { useDesignContext } from "@/lib/page-builder/design-context";
import {
  fontFamilyOptions,
  fontFamilyLabels,
  borderRadiusOptions,
  borderRadiusLabels,
  buttonStyleOptions,
  buttonStyleLabels,
  type FontFamily,
  type BorderRadius,
  type ButtonStyle,
} from "@/lib/theme/types";

export function TypographyTab() {
  const { state, updateTheme } = useDesignContext();

  return (
    <div className="space-y-5">
      {/* Body Font */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Body Font</Label>
        <div className="grid grid-cols-1 gap-1.5">
          {fontFamilyOptions.map((font) => (
            <button
              key={font}
              onClick={() =>
                updateTheme({
                  fontFamily: font as FontFamily,
                  presetName: null,
                })
              }
              className={`rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 ${
                state.theme.fontFamily === font
                  ? "border-primary bg-primary/5"
                  : ""
              }`}
            >
              {fontFamilyLabels[font]}
            </button>
          ))}
        </div>
      </div>

      {/* Heading Font */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Heading Font</Label>
        <div className="grid grid-cols-1 gap-1.5">
          <button
            onClick={() =>
              updateTheme({
                headingFontFamily: undefined,
                presetName: null,
              })
            }
            className={`rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 ${
              !state.theme.headingFontFamily
                ? "border-primary bg-primary/5"
                : ""
            }`}
          >
            Same as body
          </button>
          {fontFamilyOptions.map((font) => (
            <button
              key={font}
              onClick={() =>
                updateTheme({
                  headingFontFamily: font as FontFamily,
                  presetName: null,
                })
              }
              className={`rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 ${
                state.theme.headingFontFamily === font
                  ? "border-primary bg-primary/5"
                  : ""
              }`}
            >
              {fontFamilyLabels[font]}
            </button>
          ))}
        </div>
      </div>

      {/* Border Radius */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Border Radius</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {borderRadiusOptions.map((radius) => (
            <button
              key={radius}
              onClick={() =>
                updateTheme({
                  borderRadius: radius as BorderRadius,
                  presetName: null,
                })
              }
              className={`rounded-md border px-3 py-2 text-center text-xs transition-colors hover:bg-muted/50 ${
                state.theme.borderRadius === radius
                  ? "border-primary bg-primary/5"
                  : ""
              }`}
            >
              {borderRadiusLabels[radius]}
            </button>
          ))}
        </div>
      </div>

      {/* Button Style */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Button Style</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {buttonStyleOptions.map((style) => (
            <button
              key={style}
              onClick={() =>
                updateTheme({
                  buttonStyle: style as ButtonStyle,
                  presetName: null,
                })
              }
              className={`rounded-md border px-3 py-2 text-center text-xs transition-colors hover:bg-muted/50 ${
                state.theme.buttonStyle === style
                  ? "border-primary bg-primary/5"
                  : ""
              }`}
            >
              {buttonStyleLabels[style]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
