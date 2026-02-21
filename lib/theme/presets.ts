import type { ThemeConfig, ThemePreset } from "./types";

// ============================================================================
// DEFAULT THEME CONFIG
// ============================================================================
// Produces identical CSS vars to current globals.css — zero visual change
// for existing stores that have no themeConfig set.
// ============================================================================

export const defaultThemeConfig: ThemeConfig = {
  primaryColor: "oklch(0.205 0 0)",
  secondaryColor: "oklch(0.97 0 0)",
  accentColor: "oklch(0.97 0 0)",
  fontFamily: "geist",
  borderRadius: "md",
  buttonStyle: "solid",
  presetName: null,
};

// ============================================================================
// THEME PRESETS
// ============================================================================

export const themePresets: ThemePreset[] = [
  {
    name: "modern",
    label: "Modern",
    description: "Clean blue palette with the Geist font",
    config: {
      primaryColor: "oklch(0.55 0.15 250)",
      secondaryColor: "oklch(0.95 0.02 250)",
      accentColor: "oklch(0.65 0.18 250)",
      fontFamily: "geist",
      borderRadius: "md",
      buttonStyle: "solid",
      presetName: "modern",
    },
  },
  {
    name: "classic",
    label: "Classic",
    description: "Elegant navy with DM Sans for a timeless feel",
    config: {
      primaryColor: "oklch(0.30 0.05 260)",
      secondaryColor: "oklch(0.96 0.01 260)",
      accentColor: "oklch(0.55 0.10 260)",
      fontFamily: "dm-sans",
      borderRadius: "sm",
      buttonStyle: "outline",
      presetName: "classic",
    },
  },
  {
    name: "bold",
    label: "Bold",
    description: "Vibrant red-orange with Poppins for impact",
    config: {
      primaryColor: "oklch(0.55 0.25 30)",
      secondaryColor: "oklch(0.97 0.02 30)",
      accentColor: "oklch(0.70 0.20 50)",
      fontFamily: "poppins",
      borderRadius: "lg",
      buttonStyle: "solid",
      presetName: "bold",
    },
  },
  {
    name: "minimal",
    label: "Minimal",
    description: "Stark black and white with Inter for simplicity",
    config: {
      primaryColor: "oklch(0.205 0 0)",
      secondaryColor: "oklch(0.97 0 0)",
      accentColor: "oklch(0.97 0 0)",
      fontFamily: "inter",
      borderRadius: "none",
      buttonStyle: "outline",
      presetName: "minimal",
    },
  },
];
