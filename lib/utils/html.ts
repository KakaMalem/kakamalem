/**
 * Strips HTML tags from content for plain text display.
 * Safe to use in both server and client components.
 */
export function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * Checks if HTML content is effectively empty
 */
export function isHtmlEmpty(html: string): boolean {
  if (!html) return true;
  const stripped = stripHtml(html);
  return stripped.length === 0;
}

/**
 * Truncates HTML content to a specified length (strips HTML first)
 */
export function truncateHtml(html: string, maxLength: number): string {
  const plain = stripHtml(html);
  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).trim() + "...";
}
