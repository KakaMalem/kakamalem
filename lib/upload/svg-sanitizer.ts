/**
 * SVG Sanitizer
 *
 * Sanitizes SVG files to prevent XSS attacks via embedded JavaScript.
 * SVGs can contain malicious code via:
 * - <script> tags
 * - Event handlers (onload, onclick, onerror, etc.)
 * - <foreignObject> with embedded HTML
 * - <use> with external references
 * - javascript: URLs in href/xlink:href
 * - data: URLs that execute code
 *
 * Uses DOMPurify (via isomorphic-dompurify for Node.js) which is the
 * industry standard for HTML/SVG sanitization (~9.5M weekly downloads).
 */

import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize an SVG string, removing all potentially dangerous content.
 *
 * Keeps: paths, shapes, text, gradients, filters, viewBox, presentation attributes
 * Removes: scripts, event handlers, foreignObject, external references, data URIs
 */
export function sanitizeSvg(svgContent: string): string {
  const clean = DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true, svgFilters: true },
    // Remove dangerous elements
    FORBID_TAGS: ["script", "foreignObject", "set", "animate"],
    // Remove dangerous attributes
    FORBID_ATTR: [
      "onload",
      "onerror",
      "onclick",
      "onmouseover",
      "onmouseout",
      "onfocus",
      "onblur",
      "onanimationstart",
      "onanimationend",
      "ontransitionend",
    ],
    // Only allow safe URL schemes (block javascript: and data:)
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|ftp):\/\/|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });

  return clean;
}

/**
 * Check if a file's content looks like an SVG.
 * Inspects the first bytes for XML/SVG markers.
 */
export function isSvgContent(content: Buffer | string): boolean {
  const str =
    typeof content === "string"
      ? content.slice(0, 500)
      : content.subarray(0, 500).toString("utf-8");

  const trimmed = str.trimStart();
  return (
    trimmed.startsWith("<svg") ||
    trimmed.startsWith("<?xml") ||
    trimmed.startsWith("<!-- ") ||
    /^\s*<svg[\s>]/i.test(trimmed)
  );
}

/**
 * Sanitize an SVG file on disk (in-place).
 * Reads the file, sanitizes, and writes it back.
 */
export async function sanitizeSvgFile(filePath: string): Promise<void> {
  const { readFile, writeFile } = await import("fs/promises");
  const raw = await readFile(filePath, "utf-8");
  const sanitized = sanitizeSvg(raw);
  await writeFile(filePath, sanitized, "utf-8");
}
