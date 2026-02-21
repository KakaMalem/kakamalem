// ============================================================================
// THEME CONFIG TYPES
// ============================================================================
// Per-store theming with design tokens. Each store can customize colors, fonts,
// border radius, and button styles. ThemeConfig is stored as JSONB on tenants.
// ============================================================================

export const fontFamilyOptions = [
  "geist",
  "inter",
  "dm-sans",
  "poppins",
  "noto-naskh-arabic",
] as const;

export type FontFamily = (typeof fontFamilyOptions)[number];

export const borderRadiusOptions = [
  "none",
  "sm",
  "md",
  "lg",
  "xl",
  "full",
] as const;

export type BorderRadius = (typeof borderRadiusOptions)[number];

export const buttonStyleOptions = ["solid", "outline", "soft"] as const;

export type ButtonStyle = (typeof buttonStyleOptions)[number];

export type ExtendedColors = {
  backgroundColor?: string; // --background
  foregroundColor?: string; // --foreground
  mutedColor?: string; // --muted
  mutedForegroundColor?: string; // --muted-foreground
  borderColor?: string; // --border + --input
  cardColor?: string; // --card
  cardForegroundColor?: string; // --card-foreground
  destructiveColor?: string; // --destructive
};

export type ThemeConfig = {
  primaryColor: string; // OKLCH or hex
  secondaryColor: string;
  accentColor: string;
  fontFamily: FontFamily;
  headingFontFamily?: FontFamily;
  borderRadius: BorderRadius;
  buttonStyle: ButtonStyle;
  presetName: string | null;
  extendedColors?: ExtendedColors;
};

export type ThemePreset = {
  name: string;
  label: string;
  description: string;
  config: ThemeConfig;
};

// Font display labels for the settings UI
export const fontFamilyLabels: Record<FontFamily, string> = {
  geist: "Geist",
  inter: "Inter",
  "dm-sans": "DM Sans",
  poppins: "Poppins",
  "noto-naskh-arabic": "Noto Naskh Arabic",
};

export const borderRadiusLabels: Record<BorderRadius, string> = {
  none: "None",
  sm: "Small",
  md: "Medium",
  lg: "Large",
  xl: "Extra Large",
  full: "Full",
};

export const buttonStyleLabels: Record<ButtonStyle, string> = {
  solid: "Solid",
  outline: "Outline",
  soft: "Soft",
};
