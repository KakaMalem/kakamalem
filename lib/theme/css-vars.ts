import type { ThemeConfig, BorderRadius } from "./types";

// ============================================================================
// THEME → CSS CUSTOM PROPERTIES CONVERTER
// ============================================================================
// Converts a ThemeConfig object into CSS custom properties that override
// the default shadcn/ui variables. Injected as a <style> tag in the
// storefront layout for zero client JS.
// ============================================================================

/** Parse an OKLCH color string and return {L, C, H} or null */
function parseOklch(color: string): { l: number; c: number; h: number } | null {
  const match = color.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/);
  if (!match) return null;
  return {
    l: parseFloat(match[1]),
    c: parseFloat(match[2]),
    h: parseFloat(match[3]),
  };
}

/**
 * Get a contrasting foreground color for a given OKLCH background.
 * If the background is light (L > 0.65), return a dark foreground.
 * Otherwise, return a near-white foreground.
 */
function getContrastForeground(bgColor: string): string {
  const parsed = parseOklch(bgColor);
  if (!parsed) {
    // Fallback: if we can't parse, assume dark bg → light fg
    return "oklch(0.985 0 0)";
  }
  return parsed.l > 0.65
    ? "oklch(0.145 0 0)" // dark text on light bg
    : "oklch(0.985 0 0)"; // light text on dark bg
}

/** Map borderRadius token to CSS value */
const RADIUS_MAP: Record<BorderRadius, string> = {
  none: "0rem",
  sm: "0.25rem",
  md: "0.625rem",
  lg: "0.75rem",
  xl: "1rem",
  full: "9999px",
};

/**
 * Convert a ThemeConfig into a CSS custom properties string.
 * Output example: "--primary:oklch(0.55 0.15 250);--primary-foreground:oklch(0.985 0 0);..."
 */
export function themeConfigToCssVars(config: ThemeConfig): string {
  const vars: string[] = [];

  // Primary color
  vars.push(`--primary:${config.primaryColor}`);
  vars.push(
    `--primary-foreground:${getContrastForeground(config.primaryColor)}`
  );

  // Secondary color
  vars.push(`--secondary:${config.secondaryColor}`);
  vars.push(
    `--secondary-foreground:${getContrastForeground(config.secondaryColor)}`
  );

  // Accent color
  vars.push(`--accent:${config.accentColor}`);
  vars.push(`--accent-foreground:${getContrastForeground(config.accentColor)}`);

  // Border radius
  vars.push(`--radius:${RADIUS_MAP[config.borderRadius]}`);

  // Extended colors — override globals.css defaults when set
  if (config.extendedColors) {
    const ec = config.extendedColors;
    if (ec.backgroundColor) {
      vars.push(`--background:${ec.backgroundColor}`);
      // Card and popover default to background if not explicitly set
      if (!ec.cardColor) vars.push(`--card:${ec.backgroundColor}`);
      vars.push(`--popover:${ec.backgroundColor}`);
    }
    if (ec.foregroundColor) {
      vars.push(`--foreground:${ec.foregroundColor}`);
      if (!ec.cardForegroundColor)
        vars.push(`--card-foreground:${ec.foregroundColor}`);
      vars.push(`--popover-foreground:${ec.foregroundColor}`);
    }
    if (ec.mutedColor) vars.push(`--muted:${ec.mutedColor}`);
    if (ec.mutedForegroundColor)
      vars.push(`--muted-foreground:${ec.mutedForegroundColor}`);
    if (ec.borderColor) {
      vars.push(`--border:${ec.borderColor}`);
      vars.push(`--input:${ec.borderColor}`);
    }
    if (ec.cardColor) vars.push(`--card:${ec.cardColor}`);
    if (ec.cardForegroundColor)
      vars.push(`--card-foreground:${ec.cardForegroundColor}`);
    if (ec.destructiveColor) {
      vars.push(`--destructive:${ec.destructiveColor}`);
      vars.push(
        `--destructive-foreground:${getContrastForeground(ec.destructiveColor)}`
      );
    }
  }

  return vars.join(";");
}
