/**
 * Turning a gateway error payload into a sentence a human can read.
 *
 * HesabPay's error responses do not always put a string in `message`. A
 * rejected transfer can come back shaped like a Django REST validation error,
 * for example `{"message": {"pin": ["Invalid PIN"]}}`, and treating that as a
 * string has two nasty consequences:
 *
 * - written to a text column it becomes the literal "[object Object]", which
 *   tells nobody anything
 * - handed to a toast it reaches React as a child object, which throws
 *   "Objects are not valid as a React child" and white-screens the page
 *
 * So nothing from a gateway response is trusted to be a string. Everything goes
 * through here first.
 *
 * Two dangers come with spelling out an unknown body, and both are guarded:
 *
 * - **Secrets.** A validation error keyed by request field can echo the field's
 *   value back, and the send-money request carries the encrypted merchant PIN.
 *   Credential-shaped keys are dropped at every depth, and known secret values
 *   are scrubbed from the final string.
 * - **Echoes.** Keys that are simply our own request reflected back describe
 *   nothing. Surfacing them buries the real reason, so they are skipped.
 */

/** Keys a gateway is likely to hide the real message under. */
const MESSAGE_KEYS = ["message", "detail", "details", "error", "errors", "msg"];

/**
 * Never render these, at any depth: they carry credentials rather than
 * explanations. Matched as a substring so `api_key`, `apiKey` and
 * `merchant_pin` are all caught.
 */
const SECRET_KEY_PATTERNS = [
  "pin",
  "secret",
  "token",
  "key",
  "password",
  "authorization",
  "auth",
  "signature",
  "credential",
];

/**
 * Our own request, reflected back. Describes nothing, and rendering it makes
 * the seller's own account number look like the error.
 */
const ECHOED_REQUEST_KEYS = [
  "account_number",
  "amount",
  "vendors",
  "transaction_id",
  "success",
  "status_code",
];

const MAX_DEPTH = 4;
const MAX_LENGTH = 400;

function isSecretKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SECRET_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Tell a credential apart from an explanation about one.
 *
 * `{"pin": ["Invalid PIN."]}` is the single most likely real failure here, and
 * its value is a sentence we must show. `{"pin": "<base64 ciphertext>"}` is the
 * secret itself echoed back. Prose has spaces; tokens do not.
 */
function looksLikeCredentialValue(text: string): boolean {
  return text.length >= 12 && !/\s/.test(text);
}

/**
 * Resolve a value that sits under a credential-shaped key: keep it when it
 * reads like an explanation, drop it when it looks like the secret.
 */
function messageUnderSecretKey(
  value: unknown,
  depth: number
): string | null {
  const nested = extractGatewayMessage(value, depth);
  if (!nested) return null;
  return looksLikeCredentialValue(nested) ? null : nested;
}

function isEchoedKey(key: string): boolean {
  return ECHOED_REQUEST_KEYS.includes(key.toLowerCase());
}

function clean(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // "[object Object]" means someone already lost the information upstream.
  if (trimmed === "[object Object]") return null;
  return trimmed;
}

/**
 * Best-effort human-readable message from an arbitrary error payload.
 * Returns null when there is nothing worth showing.
 */
export function extractGatewayMessage(
  value: unknown,
  depth = 0
): string | null {
  if (value === null || value === undefined) return null;
  if (depth > MAX_DEPTH) return null;

  if (typeof value === "string") return clean(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => extractGatewayMessage(item, depth + 1))
      .filter((part): part is string => Boolean(part));
    return parts.length > 0 ? parts.join("; ") : null;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    // Prefer the conventional message-bearing keys before falling back to
    // spelling out the whole object.
    for (const key of MESSAGE_KEYS) {
      if (key in record) {
        const nested = isSecretKey(key)
          ? messageUnderSecretKey(record[key], depth + 1)
          : extractGatewayMessage(record[key], depth + 1);
        if (nested) return nested;
      }
    }

    // A field-keyed validation map: render it as "field: problem", minus
    // anything that is a credential or merely our own request echoed back.
    const parts = Object.entries(record)
      .filter(([key]) => !isEchoedKey(key))
      .map(([key, entry]) => {
        const nested = isSecretKey(key)
          ? messageUnderSecretKey(entry, depth + 1)
          : extractGatewayMessage(entry, depth + 1);
        return nested ? `${key}: ${nested}` : null;
      })
      .filter((part): part is string => Boolean(part));

    return parts.length > 0 ? parts.join("; ") : null;
  }

  return null;
}

/**
 * Remove known secret values from a string, in case one reached it through a
 * key we did not anticipate.
 */
function scrub(text: string, secrets: Array<string | undefined>): string {
  let output = text;
  for (const secret of secrets) {
    if (!secret || secret.length < 6) continue;
    while (output.includes(secret)) {
      output = output.replace(secret, "[redacted]");
    }
  }
  return output;
}

/**
 * Always returns a string safe to store and to render.
 *
 * `secrets` are values that must never appear in the result, such as the API
 * key and the merchant PIN.
 */
export function toGatewayErrorText(
  value: unknown,
  fallback: string,
  secrets: Array<string | undefined> = []
): string {
  const message = extractGatewayMessage(value);
  if (!message) return fallback;

  const safe = scrub(message, secrets);
  return safe.length > MAX_LENGTH ? `${safe.slice(0, MAX_LENGTH)}…` : safe;
}
