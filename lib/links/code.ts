/**
 * Short-code helpers for store marketing links.
 *
 * Codes appear in URLs as kakamalem.com/s/{code}. We use an unambiguous
 * lowercase alphabet (no 0/o/1/l/i) so codes are easy to read aloud and type.
 */

// Unambiguous alphabet — excludes 0 o 1 l i to avoid read/typing errors.
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const DEFAULT_LENGTH = 6;

// Codes the seller may not claim as custom codes (route/word collisions).
const RESERVED_CODES = new Set([
  "s",
  "new",
  "edit",
  "admin",
  "api",
  "store",
  "dashboard",
  "link",
  "links",
  "qr",
]);

/**
 * Generate a random short code using the Web Crypto API (available in both
 * Node and edge runtimes).
 */
export function generateLinkCode(length: number = DEFAULT_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

/**
 * Validate a seller-provided custom code. Returns an error message, or null
 * if the code is acceptable.
 */
export function validateCustomCode(raw: string): string | null {
  const code = raw.trim().toLowerCase();
  if (code.length < 3) return "Code must be at least 3 characters";
  if (code.length > 50) return "Code must be 50 characters or less";
  if (!/^[a-z0-9-]+$/.test(code)) {
    return "Use only lowercase letters, numbers, and hyphens";
  }
  if (code.startsWith("-") || code.endsWith("-")) {
    return "Code cannot start or end with a hyphen";
  }
  if (RESERVED_CODES.has(code)) return "That code is reserved";
  return null;
}

/** Normalize a custom code to its stored form. */
export function normalizeCode(raw: string): string {
  return raw.trim().toLowerCase();
}
