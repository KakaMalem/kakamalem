/**
 * CSS sanitizer for user-provided custom CSS (pro plan feature).
 * Blocks dangerous patterns while allowing legitimate styling.
 */

const MAX_CSS_LENGTH = 10 * 1024; // 10KB

// Patterns that are always dangerous
const BLOCKED_PATTERNS: { pattern: RegExp; description: string }[] = [
  { pattern: /<script/i, description: "Script tags are not allowed" },
  {
    pattern: /javascript\s*:/i,
    description: "JavaScript URLs are not allowed",
  },
  {
    pattern: /expression\s*\(/i,
    description: "CSS expressions are not allowed",
  },
  { pattern: /-moz-binding/i, description: "-moz-binding is not allowed" },
  { pattern: /behavior\s*:/i, description: "behavior property is not allowed" },
  {
    pattern: /@import\s+url\s*\(\s*["']?https?:/i,
    description: "External @import URLs are not allowed",
  },
  {
    pattern: /url\s*\(\s*["']?data\s*:\s*text\/html/i,
    description: "data:text/html URLs are not allowed",
  },
  {
    pattern: /url\s*\(\s*["']?javascript/i,
    description: "JavaScript URLs in url() are not allowed",
  },
  { pattern: /<\/?\w+[^>]*>/g, description: "HTML tags are not allowed" },
];

export interface SanitizeResult {
  css: string;
  warnings: string[];
}

/**
 * Sanitize user-provided CSS.
 * Returns cleaned CSS and any warnings about removed content.
 */
export function sanitizeCss(input: string): SanitizeResult {
  const warnings: string[] = [];

  if (!input || input.trim().length === 0) {
    return { css: "", warnings };
  }

  // Enforce size limit
  if (input.length > MAX_CSS_LENGTH) {
    warnings.push(`CSS exceeds ${MAX_CSS_LENGTH / 1024}KB limit, truncated`);
    input = input.slice(0, MAX_CSS_LENGTH);
  }

  let css = input;

  // Strip HTML tags entirely
  css = css.replace(/<\/?\w+[^>]*>/g, "");

  // Check for blocked patterns
  for (const { pattern, description } of BLOCKED_PATTERNS) {
    if (pattern.test(css)) {
      warnings.push(description);
      // Remove the blocked pattern
      css = css.replace(pattern, "/* blocked */");
    }
  }

  // Remove null bytes
  css = css.replace(/\0/g, "");

  // Remove CSS comments that might contain malicious content
  // (but preserve the CSS structure)
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");

  return { css: css.trim(), warnings };
}

/**
 * Validate CSS length for the UI character counter.
 */
export function getCssLengthInfo(css: string): {
  length: number;
  maxLength: number;
  isOverLimit: boolean;
  percentage: number;
} {
  const length = css.length;
  return {
    length,
    maxLength: MAX_CSS_LENGTH,
    isOverLimit: length > MAX_CSS_LENGTH,
    percentage: Math.min(100, Math.round((length / MAX_CSS_LENGTH) * 100)),
  };
}
